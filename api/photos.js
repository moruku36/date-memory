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

      // 📅 デート日（YYYY-MM-DD）ごとの正確な訪問スポット定義
      const DATE_SPOT_MAP = {
        "2026-05-16": { name: "三浦半島・城ヶ島・三崎港", lat: 35.1365, lng: 139.6190 },
        "2026-05-23": { name: "ICU（国際基督教大学・三鷹）", lat: 35.6882, lng: 139.5303 },
        "2026-05-24": { name: "ICU（国際基督教大学・三鷹）", lat: 35.6882, lng: 139.5303 },
        "2026-05-30": { name: "さいたま（大宮 花の丘農林公園・与野ばら園）", lat: 35.9550, lng: 139.5850 },
        "2026-06-06": { name: "吉祥寺・井の頭自然文化園", lat: 35.7001, lng: 139.5744 },
        "2026-06-13": { name: "神楽坂・飯田橋", lat: 35.7018, lng: 139.7408 },
        "2026-06-21": { name: "恵比寿ガーデンプレイス・公園", lat: 35.6425, lng: 139.7135 },
        "2026-06-28": { name: "帝国ホテル 東京・日比谷", lat: 35.6725, lng: 139.7588 },
        "2026-07-11": { name: "銀座・丸の内", lat: 35.6715, lng: 139.7650 },
        "2026-07-12": { name: "銀座・丸の内", lat: 35.6715, lng: 139.7650 },
        "2026-07-25": { name: "おうちデート（吉祥寺）", lat: 35.7030, lng: 139.5800 },
        "2026-08-01": { name: "青山・表参道カフェ", lat: 35.6653, lng: 139.7123 },
        "2026-08-02": { name: "青山・表参道カフェ", lat: 35.6653, lng: 139.7123 },
        "2026-08-16": { name: "横浜赤レンガ倉庫・みなとみらい", lat: 35.4528, lng: 139.6428 },
        "2026-08-23": { name: "ワーナーブラザース スタジオツアー東京（としまえん）", lat: 35.7447, lng: 139.6480 },
        "2026-08-29": { name: "高円寺阿波おどり（高円寺）", lat: 35.7053, lng: 139.6497 },
        "2026-08-30": { name: "横浜・馬車道ディナー", lat: 35.4490, lng: 139.6360 },
      };

      const DEFAULT_SPOTS = [
        { name: "東京駅・丸の内", lat: 35.6812, lng: 139.7671 },
        { name: "渋谷・表参道", lat: 35.6628, lng: 139.7038 },
        { name: "吉祥寺・井の頭公園", lat: 35.7001, lng: 139.5794 },
        { name: "横浜みなとみらい", lat: 35.4522, lng: 139.6380 },
      ];

      const backfillPromises = [];
      docs.forEach((doc, idx) => {
        // 写真の撮影日・日付を取得
        const rawDate = doc.sortTime || doc.date || doc.createdAt;
        let dateKey = "";
        if (rawDate) {
          const num = Number(rawDate);
          const dateObj = new Date(!isNaN(num) && num < 1e11 ? num * 1000 : rawDate);
          if (!isNaN(dateObj.getTime())) {
            dateKey = dateObj.toISOString().slice(0, 10);
          }
        }

        const spot = DATE_SPOT_MAP[dateKey] || DEFAULT_SPOTS[idx % DEFAULT_SPOTS.length];

        // 以前の誤ったラウンドロビン位置（湘南、鎌倉などへの誤紐付け）または未設定の場合は正確なスポットに更新
        const isDefaultLocation = !doc.location || typeof doc.location.lat !== "number";
        const isKnownMismatch = DATE_SPOT_MAP[dateKey] && (!doc.location?.spotName || doc.location.spotName !== spot.name);

        if (isDefaultLocation || isKnownMismatch) {
          const jitterLat = ((idx * 13) % 20 - 10) * 0.0012;
          const jitterLng = ((idx * 17) % 20 - 10) * 0.0012;
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
