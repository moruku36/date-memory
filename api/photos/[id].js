const {
  collectionName,
  defaultAlbumId,
  getDatabase,
  safeImageContentType,
  setCorsHeaders,
} = require("../_mongo");

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  try {
    const db = await getDatabase();
    const collection = db.collection(collectionName());
    const albumId = req.query.albumId || defaultAlbumId();
    const id = req.query.id;

    if (req.method === "GET") {
      const photo = await collection.findOne({ id, albumId });
      if (!photo) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.setHeader("Content-Type", safeImageContentType(photo.type));
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.status(200).send(photo.image.buffer || photo.image);
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

    res.setHeader("Allow", "GET,DELETE,OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
