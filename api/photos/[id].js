const {
  collectionName,
  createThumbnail,
  defaultAlbumId,
  getDatabase,
  isValidAlbumId,
  publicPhoto,
  readJson,
  safeImageContentType,
  setCorsHeaders,
  storedBuffer,
} = require("../_mongo");

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
    const id = req.query.id;

    if (req.method === "GET") {
      const photo = await collection.findOne({ id, albumId });
      if (!photo) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const wantsThumbnail = req.query.variant === "thumb";
      let image = wantsThumbnail ? storedBuffer(photo.thumbnail) : storedBuffer(photo.image);
      let contentType = wantsThumbnail
        ? safeImageContentType(photo.thumbnailType)
        : safeImageContentType(photo.type);

      if (wantsThumbnail && !image) {
        const original = storedBuffer(photo.image);
        if (original) {
          try {
            const thumbnail = await createThumbnail(original);
            image = thumbnail.buffer;
            contentType = thumbnail.contentType;
            await collection.updateOne(
              { id, albumId },
              {
                $set: {
                  thumbnail: thumbnail.buffer,
                  thumbnailType: thumbnail.contentType,
                  thumbnailCreatedAt: new Date(),
                },
              },
            );
          } catch (error) {
            console.warn("Thumbnail backfill failed.", error);
            image = original;
            contentType = safeImageContentType(photo.type);
          }
        }
      }

      if (!image) {
        res.status(404).json({ error: "Image not found" });
        return;
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("CDN-Cache-Control", "public, max-age=31536000, immutable");
      res.status(200).send(image);
      return;
    }

    if (req.method === "PATCH") {
      const body = await readJson(req);
      const updateFields = { updatedAt: new Date() };

      if (typeof body.memo === "string") {
        updateFields.memo = body.memo.slice(0, 1000);
      }
      if (typeof body.favorite === "boolean") {
        updateFields.favorite = body.favorite;
      }
      if (Array.isArray(body.tags)) {
        updateFields.tags = body.tags.map((t) => String(t).slice(0, 50)).slice(0, 20);
      }
      if (Number.isFinite(Number(body.date))) {
        updateFields.sortTime = Number(body.date);
      }

      const result = await collection.findOneAndUpdate(
        { id, albumId },
        { $set: updateFields },
        { returnDocument: "after" }
      );

      if (!result) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.status(200).json({ photo: publicPhoto(result.value || result) });
      return;
    }

    if (req.method === "DELETE") {
      const result = await collection.deleteOne({ id, albumId });
      if (!result.deletedCount) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET,PATCH,DELETE,OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
