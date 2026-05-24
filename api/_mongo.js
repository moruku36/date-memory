const { MongoClient } = require("mongodb");

let cachedClient;

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
    return Promise.resolve(req.body);
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

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
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
  setCorsHeaders,
};
