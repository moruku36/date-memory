const {
  collectionName,
  defaultAlbumId,
  getDatabase,
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

      res.setHeader("Content-Type", photo.type || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.status(200).send(photo.image.buffer || photo.image);
      return;
    }

    res.setHeader("Allow", "GET,OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
