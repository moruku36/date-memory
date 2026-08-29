const { MongoClient } = require("mongodb");
const sharp = require("sharp");

let cachedClient;
let indexesPromise;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const THUMBNAIL_MAX_EDGE = 480;
const THUMBNAIL_QUALITY = 72;
const THUMBNAIL_MAX_BYTES = 700 * 1024;

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

function ensurePhotoIndexes(collection) {
  if (!indexesPromise) {
    indexesPromise = collection.createIndexes([
      { key: { albumId: 1, sortTime: 1, createdAt: 1 }, name: "album_sort" },
      { key: { albumId: 1, id: 1 }, name: "album_photo" },
    ]).catch((error) => {
      indexesPromise = null;
      throw error;
    });
  }

  return indexesPromise;
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

function storedBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Buffer.isBuffer(value.buffer)) return value.buffer;
  if (value.buffer instanceof ArrayBuffer) {
    return Buffer.from(value.buffer, value.byteOffset || 0, value.byteLength || value.buffer.byteLength);
  }
  return null;
}

async function createThumbnail(buffer) {
  const thumbnail = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: THUMBNAIL_MAX_EDGE,
      height: THUMBNAIL_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: THUMBNAIL_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();

  return {
    buffer: thumbnail,
    contentType: "image/jpeg",
  };
}

function timestamp(value, fallback = Date.now()) {
  if (!value) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function publicPhoto(doc) {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    date: doc.sortTime,
    width: doc.width || 0,
    height: doc.height || 0,
    hasThumbnail: Boolean(doc.thumbnailType || storedBuffer(doc.thumbnail)),
    updatedAt: timestamp(doc.updatedAt || doc.createdAt || doc.sortTime),
    source: "cloud",
  };
}

module.exports = {
  collectionName,
  createThumbnail,
  dataUrlToBuffer,
  defaultAlbumId,
  ensurePhotoIndexes,
  getDatabase,
  publicPhoto,
  readJson,
  safeImageContentType,
  setCorsHeaders,
  storedBuffer,
  THUMBNAIL_MAX_BYTES,
};
