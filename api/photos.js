const crypto = require("crypto");
const {
  collectionName,
  dataUrlToBuffer,
  defaultAlbumId,
  getDatabase,
  publicPhoto,
  readJson,
  setCorsHeaders,
} = require("./_mongo");

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  try {
    const db = await getDatabase();
    const collection = db.collection(collectionName());
    const albumId = req.query.albumId || defaultAlbumId();

    if (req.method === "GET") {
      const docs = await collection
        .find({ albumId }, { projection: { image: 0 } })
        .sort({ sortTime: 1, createdAt: 1 })
        .toArray();

      res.status(200).json({ photos: docs.map(publicPhoto) });
      return;
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const id = body.id || crypto.randomUUID();
      const { buffer, contentType } = dataUrlToBuffer(body.dataUrl);

      if (buffer.length > 8 * 1024 * 1024) {
        res.status(413).json({ error: "Image is too large" });
        return;
      }

      const photo = {
        id,
        albumId: body.albumId || albumId,
        name: body.name || "memory-photo.jpg",
        type: body.type || contentType,
        sortTime: Number(body.date) || Date.now(),
        width: Number(body.width) || 0,
        height: Number(body.height) || 0,
        image: buffer,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await collection.updateOne(
        { id: photo.id, albumId: photo.albumId },
        { $set: photo },
        { upsert: true },
      );

      res.status(200).json({ photo: publicPhoto(photo) });
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
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
