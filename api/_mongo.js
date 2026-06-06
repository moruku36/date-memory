const { MongoClient } = require("mongodb");

let cachedClient;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function getDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }

  return cachedClient.db(process.env.MONGODB_DB || "date_memory");
}

function collectionName() {
  return process.env.MONGODB_COLLECTION || "photos";
}

function defaultAlbumId() {
  return process.env.ALBUM_ID || "date-memory-main";
}

function setCorsHeaders(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Admin-Token");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

function readJson(req) {
  if (req.body && typeof req.body === "object") {
    if (Buffer.isBuffer(req.body)) {
      return Promise.resolve(JSON.parse(req.body.toString("utf8") || "{}"));
    }
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string") {
    return Promise.resolve(JSON.parse(req.body || "{}"));
  }

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) {
    throw new Error("Invalid image payload");
  }

  const contentType = match[1].toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
    throw new Error("Unsupported image type");
  }

  return {
    contentType,
    buffer: Buffer.from(match[2], "base64"),
  };
}

function safeImageContentType(value) {
  const contentType = String(value || "").toLowerCase();
  return SUPPORTED_IMAGE_TYPES.has(contentType) ? contentType : "image/jpeg";
}

function publicPhoto(doc) {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    date: doc.sortTime,
    width: doc.width || 0,
    height: doc.height || 0,
    source: "cloud",
  };
}

module.exports = {
  collectionName,
  dataUrlToBuffer,
  defaultAlbumId,
  getDatabase,
  publicPhoto,
  readJson,
  safeImageContentType,
  setCorsHeaders,
};
