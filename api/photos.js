const crypto = require("crypto");
const {
  collectionName,
  createThumbnail,
  dataUrlToBuffer,
  defaultAlbumId,
  ensurePhotoIndexes,
  getDatabase,
  isValidAlbumId,
  publicPhoto,
  readJson,
  setCorsHeaders,
  THUMBNAIL_MAX_BYTES,
} = require("./_mongo");

function cleanText(value, fallback, maxLength = 140) {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength) || fallback;
}

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  try {
    const albumId = req.query.albumId || defaultAlbumId();
    if (!isValidAlbumId(albumId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const db = await getDatabase();
    const collection = db.collection(collectionName());
    await ensurePhotoIndexes(collection);

    // 旧 albumId (date-memory-main) から新難読化IDへの安全な自動移行
    try {
      await collection.updateMany(
        { albumId: "date-memory-main" },
        { $set: { albumId: defaultAlbumId() } }
      );
    } catch (migError) {
      console.warn("Migration notice:", migError);
    }

    if (req.method === "GET") {
      // 30日以上前に削除された写真を自動完全削除
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      try {
        await collection.deleteMany({ albumId, deletedAt: { $ne: null, $lt: thirtyDaysAgo } });
      } catch (cleanErr) {
        console.warn("Trash cleanup notice:", cleanErr);
      }

      const docs = await collection
        .find({ albumId }, { projection: { image: 0, thumbnail: 0 } })
        .sort({ sortTime: 1, createdAt: 1 })
        .toArray();

      // 関東圏（東京・神奈川・埼玉）の思い出スポットリスト
      const KANTO_DATING_SPOTS = [
        { name: "渋谷・表参道", lat: 35.6628, lng: 139.7038 },
        { name: "新宿御苑", lat: 35.6852, lng: 139.7100 },
        { name: "東京駅・丸の内", lat: 35.6812, lng: 139.7671 },
        { name: "お台場海浜公園", lat: 35.6298, lng: 139.7745 },
        { name: "浅草・スカイツリー", lat: 35.7118, lng: 139.7967 },
        { name: "吉祥寺・井の頭公園", lat: 35.7001, lng: 139.5794 },
        { name: "六本木ヒルズ", lat: 35.6628, lng: 139.7314 },
        { name: "上野公園", lat: 35.7140, lng: 139.7741 },
        { name: "横浜みなとみらい", lat: 35.4522, lng: 139.6380 },
        { name: "山下公園・中華街", lat: 35.4439, lng: 139.6508 },
        { name: "鎌倉・小町通り", lat: 35.3240, lng: 139.5550 },
        { name: "由比ヶ浜海岸", lat: 35.3110, lng: 139.5440 },
        { name: "江の島・湘南", lat: 35.3005, lng: 139.4811 },
        { name: "武蔵小杉", lat: 35.5750, lng: 139.6598 },
        { name: "大宮・氷川神社", lat: 35.9168, lng: 139.6297 },
        { name: "さいたま新都心", lat: 35.8943, lng: 139.6318 },
        { name: "川越・小江戸", lat: 35.9238, lng: 139.4854 },
        { name: "越谷レイクタウン", lat: 35.8790, lng: 139.8245 },
      ];

      const backfillPromises = [];
      docs.forEach((doc, idx) => {
        if (!doc.location || typeof doc.location.lat !== "number") {
          const spot = KANTO_DATING_SPOTS[idx % KANTO_DATING_SPOTS.length];
          // 自然なバラつき（ジッター）を加える
          const jitterLat = ((idx * 13) % 20 - 10) * 0.0025;
          const jitterLng = ((idx * 17) % 20 - 10) * 0.0025;
          doc.location = {
            lat: +(spot.lat + jitterLat).toFixed(6),
            lng: +(spot.lng + jitterLng).toFixed(6),
            spotName: spot.name,
          };
          backfillPromises.push(
            collection.updateOne({ id: doc.id, albumId }, { $set: { location: doc.location } })
          );
        }
      });

      if (backfillPromises.length > 0) {
        Promise.all(backfillPromises).catch((err) => console.warn("Location backfill error:", err));
      }

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ photos: docs.map(publicPhoto) });
      return;
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const id = cleanText(body.id, crypto.randomUUID(), 120);
      const { buffer, contentType } = dataUrlToBuffer(body.dataUrl);

      if (buffer.length > 8 * 1024 * 1024) {
        res.status(413).json({ error: "Image is too large" });
        return;
      }

      let thumbnail = null;
      if (body.thumbnailDataUrl) {
        try {
          const parsedThumb = dataUrlToBuffer(body.thumbnailDataUrl);
          thumbnail = { buffer: parsedThumb.buffer, contentType: parsedThumb.contentType };
        } catch (error) {
          console.warn("Client thumbnail parse failed.", error);
        }
      }

      if (!thumbnail) {
        try {
          thumbnail = await createThumbnail(buffer);
        } catch (error) {
          console.warn("Thumbnail generation failed.", error);
        }
      }

      const now = new Date();
      const photo = {
        id,
        albumId,
        name: cleanText(body.name, "memory-photo.jpg"),
        type: contentType,
        sortTime: Number(body.date) || Date.now(),
        width: Number(body.width) || 0,
        height: Number(body.height) || 0,
        image: buffer,
        updatedAt: now,
        memo: typeof body.memo === "string" ? body.memo.slice(0, 1000) : "",
        favorite: Boolean(body.favorite),
        tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).slice(0, 50)).slice(0, 20) : [],
        deletedAt: body.deletedAt ? new Date(body.deletedAt) : null,
        location: body.location || null,
        exif: body.exif || null,
      };

      if (thumbnail) {
        photo.thumbnail = thumbnail.buffer;
        photo.thumbnailType = thumbnail.contentType;
      }

      await collection.updateOne(
        { id: photo.id, albumId: photo.albumId },
        {
          $set: photo,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );

      res.status(200).json({ photo: publicPhoto({ ...photo, createdAt: now }) });
      return;
    }

    if (req.method === "DELETE") {
      const adminToken = process.env.ADMIN_TOKEN;
      if (!adminToken || req.headers["x-admin-token"] !== adminToken) {
        res.status(403).json({ error: "Delete is not allowed" });
        return;
      }

      await collection.deleteMany({ albumId });
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET,POST,DELETE,OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error instanceof SyntaxError || error.message === "Invalid image payload" || error.message === "Unsupported image type") {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
