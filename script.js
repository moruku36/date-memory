const DB_NAME = "couple-memory-album";
const DB_VERSION = 1;
const STORE_NAME = "photos";
const PREFERENCES_KEY = "couple-memory-preferences";
const DEFAULT_ALBUM_NAME = "デートのメモリー";
const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const CLOUD_CONFIG = window.DATE_MEMORY_CLOUD || {};
const API_OPTIMIZE_THRESHOLD_BYTES = 1.8 * 1024 * 1024;
const API_MAX_IMAGE_EDGE = 1800;
const API_WEB_FRIENDLY_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const state = {
  photos: [],
  currentIndex: 0,
  activeCollection: "all",
  isPlaying: false,
  timer: null,
  speed: 4000,
  view: "mosaic",
  mood: "cinema",
  selectionMode: false,
  selectedIds: new Set(),
};

const cloud = {
  client: null,
  ready: false,
  loading: false,
  error: "",
  provider: CLOUD_CONFIG.provider || (CLOUD_CONFIG.apiBaseUrl ? "api" : "supabase"),
  apiBaseUrl: (CLOUD_CONFIG.apiBaseUrl || "").replace(/\/$/, ""),
  adminToken: CLOUD_CONFIG.adminToken || "",
  url: CLOUD_CONFIG.supabaseUrl || CLOUD_CONFIG.url || "",
  anonKey: CLOUD_CONFIG.supabaseAnonKey || CLOUD_CONFIG.anonKey || "",
  bucket: CLOUD_CONFIG.bucket || "date-memory",
  table: CLOUD_CONFIG.table || "date_memory_photos",
  albumId: CLOUD_CONFIG.albumId || "date-memory-main",
};

const els = {
  input: document.getElementById("photoInput"),
  dropZone: document.getElementById("dropZone"),
  emptyPanel: document.getElementById("emptyPanel"),
  heroPhoto: document.getElementById("heroPhoto"),
  currentPhoto: document.getElementById("currentPhoto"),
  stageBg: document.getElementById("stageBg"),
  memoryDate: document.getElementById("memoryDate"),
  memoryTitle: document.getElementById("memoryTitle"),
  memoryCounter: document.getElementById("memoryCounter"),
  stageControls: document.getElementById("stageControls"),
  playBtn: document.getElementById("playBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  albumName: document.getElementById("albumName"),
  collectionList: document.getElementById("collectionList"),
  photoCount: document.getElementById("photoCount"),
  speedRange: document.getElementById("speedRange"),
  speedValue: document.getElementById("speedValue"),
  thumbGrid: document.getElementById("thumbGrid"),
  selectionActions: document.getElementById("selectionActions"),
  selectionCount: document.getElementById("selectionCount"),
  selectModeBtn: document.getElementById("selectModeBtn"),
  selectModeLabel: document.getElementById("selectModeLabel"),
  deleteSelectedBtn: document.getElementById("deleteSelectedBtn"),
  albumImportInput: document.getElementById("albumImportInput"),
  exportBtn: document.getElementById("exportBtn"),
  shareStatus: document.getElementById("shareStatus"),
  syncBadge: document.getElementById("syncBadge"),
  syncMessage: document.getElementById("syncMessage"),
  syncNowBtn: document.getElementById("syncNowBtn"),
  clearBtn: document.getElementById("clearBtn"),
  confirmDialog: document.getElementById("confirmDialog"),
  confirmClear: document.getElementById("confirmClear"),
  themeToggle: document.getElementById("themeToggle"),
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function readAllPhotos() {
  return withStore("readonly", (store) => {
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

function savePhoto(photo) {
  return withStore("readwrite", (store) => store.put(photo));
}

function clearPhotos() {
  return withStore("readwrite", (store) => store.clear());
}

function deleteLocalPhotos(photoIds) {
  if (!photoIds.length) return Promise.resolve();
  return withStore("readwrite", (store) => {
    photoIds.forEach((photoId) => store.delete(photoId));
  });
}

function generatePhotoId() {
  const unique = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${Date.now()}-${unique}`;
}

function isCloudConfigured() {
  if (cloud.provider === "api") {
    return CLOUD_CONFIG.enabled !== false;
  }

  return Boolean(
    CLOUD_CONFIG.enabled !== false
      && cloud.url
      && cloud.anonKey
      && !cloud.url.includes("YOUR_")
      && !cloud.anonKey.includes("YOUR_")
  );
}

function cloudPhotoCount() {
  return state.photos.filter((photo) => photo.source === "cloud").length;
}

function localOnlyPhotos() {
  return state.photos.filter((photo) => photo.blob && photo.source !== "cloud");
}

function hasCloudPhotos() {
  return state.photos.some((photo) => photo.source === "cloud");
}

function canDeleteEntireCloudAlbum() {
  return cloud.provider !== "api" || Boolean(cloud.adminToken);
}

function selectedPhotos() {
  return state.photos.filter((photo) => state.selectedIds.has(photo.id));
}

function pruneSelection() {
  const existingIds = new Set(state.photos.map((photo) => photo.id));
  state.selectedIds.forEach((photoId) => {
    if (!existingIds.has(photoId)) state.selectedIds.delete(photoId);
  });
  if (!state.photos.length) state.selectionMode = false;
}

function updateSelectionControls() {
  const selectedCount = state.selectedIds.size;
  els.selectModeBtn.disabled = !state.photos.length;
  els.selectModeBtn.classList.toggle("active", state.selectionMode);
  els.selectModeBtn.setAttribute("aria-pressed", state.selectionMode ? "true" : "false");
  els.selectModeLabel.textContent = state.selectionMode ? "完了" : "選択";
  els.selectionActions.hidden = !state.selectionMode;
  els.selectionCount.textContent = `${selectedCount}枚選択中`;
  els.deleteSelectedBtn.disabled = selectedCount === 0 || cloud.loading;
}

function updateSyncStatus(message) {
  const localCount = localOnlyPhotos().length;

  if (!isCloudConfigured()) {
    els.syncBadge.textContent = "この端末のみ";
    els.syncMessage.textContent = message || "クラウド未設定です。MongoDB APIを設定すると、PCとスマホで同じ写真を見られます。";
    els.syncNowBtn.disabled = true;
    return;
  }

  if (cloud.loading) {
    els.syncBadge.textContent = "同期中";
    els.syncMessage.textContent = message || "クラウドと同期しています。";
    els.syncNowBtn.disabled = true;
    return;
  }

  if (!cloud.ready) {
    els.syncBadge.textContent = "未接続";
    els.syncMessage.textContent = message || cloud.error || "クラウドに接続できませんでした。";
    els.syncNowBtn.disabled = true;
    return;
  }

  els.syncBadge.textContent = "クラウド同期";
  els.syncMessage.textContent = message || `${cloudPhotoCount()}枚をクラウドから表示しています。`;
  els.syncNowBtn.disabled = localCount === 0;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(timestamp));
}

function formatMonth(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(new Date(timestamp));
}

function sortPhotos() {
  state.photos.sort((a, b) => a.date - b.date);
}

function createPhotoUrl(photo) {
  if (photo.url) return photo.url;
  if (!photo.blob) return "";
  photo.url = URL.createObjectURL(photo.blob);
  return photo.url;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  if (!meta || !base64) throw new Error("Invalid data URL");

  const mimeMatch = meta.match(/^data:(.*?);base64$/);
  const mimeType = mimeMatch?.[1] || "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function revokePhotoUrls() {
  state.photos.forEach((photo) => {
    if (photo.url) URL.revokeObjectURL(photo.url);
    photo.url = "";
  });
}

function visiblePhotos() {
  if (state.activeCollection === "all") return state.photos;
  return state.photos.filter((photo) => formatMonth(photo.date) === state.activeCollection);
}

function currentVisibleIndex() {
  const photos = visiblePhotos();
  const current = state.photos[state.currentIndex];
  const index = photos.findIndex((photo) => current && photo.id === current.id);
  return index >= 0 ? index : 0;
}

function setCurrentByVisibleIndex(index) {
  const photos = visiblePhotos();
  if (!photos.length) return;
  const normalized = (index + photos.length) % photos.length;
  state.currentIndex = state.photos.findIndex((photo) => photo.id === photos[normalized].id);
  render();
}

function buildCollections() {
  const groups = new Map();
  state.photos.forEach((photo) => {
    const month = formatMonth(photo.date);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(photo);
  });

  return [
    { id: "all", label: "すべての写真", count: state.photos.length, cover: state.photos[0] },
    ...Array.from(groups, ([id, photos]) => ({
      id,
      label: id,
      count: photos.length,
      cover: photos[0],
    })),
  ];
}

function renderCollections() {
  els.collectionList.innerHTML = "";
  buildCollections().forEach((collection) => {
    if (!collection.count) return;

    const button = document.createElement("button");
    button.className = `collection-item${collection.id === state.activeCollection ? " active" : ""}`;
    button.type = "button";
    button.dataset.collection = collection.id;

    const img = document.createElement("img");
    img.src = createPhotoUrl(collection.cover);
    img.alt = "";

    const text = document.createElement("span");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    title.textContent = collection.label;
    meta.textContent = `${collection.count}枚`;
    text.append(title, meta);

    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = ">";

    button.append(img, text, arrow);
    button.addEventListener("click", () => {
      state.activeCollection = collection.id;
      const first = collection.id === "all" ? state.photos[0] : state.photos.find((photo) => formatMonth(photo.date) === collection.id);
      state.currentIndex = Math.max(0, state.photos.findIndex((photo) => photo.id === first?.id));
      render();
    });
    els.collectionList.append(button);
  });
}

function renderHero() {
  const hasPhotos = state.photos.length > 0;
  els.emptyPanel.hidden = hasPhotos;
  els.heroPhoto.hidden = !hasPhotos;
  els.stageControls.hidden = !hasPhotos;
  els.clearBtn.disabled = !hasPhotos;
  els.exportBtn.disabled = !hasPhotos;

  if (!hasPhotos) {
    els.stageBg.style.backgroundImage = "";
    els.photoCount.textContent = "0枚";
    return;
  }

  const current = state.photos[state.currentIndex] || state.photos[0];
  const url = createPhotoUrl(current);
  els.currentPhoto.src = url;
  els.currentPhoto.alt = current.name;
  els.stageBg.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.34)), url("${url}")`;
  els.memoryDate.textContent = formatDate(current.date);
  els.memoryTitle.textContent = els.albumName.value.trim() || DEFAULT_ALBUM_NAME;

  const photos = visiblePhotos();
  els.memoryCounter.textContent = `${currentVisibleIndex() + 1} / ${photos.length}`;
  els.photoCount.textContent = `${state.photos.length}枚`;

  els.heroPhoto.classList.remove("portrait", "landscape");
  if (current.width && current.height) {
    els.heroPhoto.classList.add(current.height > current.width ? "portrait" : "landscape");
  }

  els.currentPhoto.style.animation = "none";
  requestAnimationFrame(() => {
    els.currentPhoto.style.animation = "";
  });
}

function renderThumbs() {
  const photos = visiblePhotos();
  els.thumbGrid.innerHTML = "";
  els.thumbGrid.className = `thumb-grid ${state.view}`;

  photos.forEach((photo, index) => {
    const globalIndex = state.photos.findIndex((item) => item.id === photo.id);
    const button = document.createElement("button");
    button.className = "thumb";
    button.type = "button";
    button.dataset.id = photo.id;
    const selected = state.selectedIds.has(photo.id);
    button.setAttribute("aria-label", state.selectionMode
      ? `${photo.name}${selected ? "の選択を解除" : "を選択"}`
      : `${photo.name}を表示`);

    if (state.view === "mosaic") {
      if (index % 9 === 0) button.classList.add("wide");
      if (index % 7 === 3) button.classList.add("tall");
    }

    if (state.selectionMode) {
      button.classList.add("selectable");
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }

    if (selected) {
      button.classList.add("selected");
    }

    if (globalIndex === state.currentIndex) {
      button.classList.add("active");
    }

    const img = document.createElement("img");
    img.src = createPhotoUrl(photo);
    img.alt = photo.name;

    const meta = document.createElement("span");
    meta.className = "thumb-meta";
    const order = document.createElement("span");
    const date = document.createElement("span");
    order.textContent = String(index + 1);
    date.textContent = formatDate(photo.date).replace("年", ".").replace("月", ".").replace("日", "");
    meta.append(order, date);

    const check = document.createElement("span");
    check.className = "thumb-check";
    check.setAttribute("aria-hidden", "true");

    button.append(img, check, meta);
    button.addEventListener("click", () => {
      if (state.selectionMode) {
        if (selected) {
          state.selectedIds.delete(photo.id);
        } else {
          state.selectedIds.add(photo.id);
        }
        render();
        return;
      }

      state.currentIndex = globalIndex;
      pauseMemory();
      render();
    });
    els.thumbGrid.append(button);
  });
}

function render() {
  const current = state.photos[state.currentIndex];
  sortPhotos();
  pruneSelection();
  if (current) {
    const nextIndex = state.photos.findIndex((photo) => photo.id === current.id);
    if (nextIndex >= 0) state.currentIndex = nextIndex;
  }
  if (state.currentIndex >= state.photos.length) state.currentIndex = 0;

  renderHero();
  renderCollections();
  renderThumbs();
  els.playBtn.classList.toggle("is-playing", state.isPlaying);
  updateSelectionControls();
  updateSyncStatus();
}

function nextPhoto() {
  setCurrentByVisibleIndex(currentVisibleIndex() + 1);
}

function previousPhoto() {
  setCurrentByVisibleIndex(currentVisibleIndex() - 1);
}

function playMemory() {
  if (!state.photos.length || state.isPlaying) return;
  state.isPlaying = true;
  els.playBtn.classList.add("is-playing");
  state.timer = window.setInterval(nextPhoto, state.speed);
}

function pauseMemory() {
  state.isPlaying = false;
  els.playBtn.classList.remove("is-playing");
  window.clearInterval(state.timer);
  state.timer = null;
}

function toggleMemory() {
  if (state.isPlaying) {
    pauseMemory();
  } else {
    playMemory();
  }
}

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

function isSupportedImageFile(file) {
  return file.type.startsWith("image/") && file.type.toLowerCase() !== "image/svg+xml";
}

function apiUrl(path, params = {}) {
  const query = new URLSearchParams({
    albumId: cloud.albumId,
    ...params,
  });
  return `${cloud.apiBaseUrl}${path}?${query.toString()}`;
}

async function optimizeImageForApi(file) {
  const originalDimensions = await getImageDimensions(file);
  const needsResize = file.size > API_OPTIMIZE_THRESHOLD_BYTES;
  const needsFormatConversion = !API_WEB_FRIENDLY_IMAGE_TYPES.has(file.type.toLowerCase());
  if (!originalDimensions.width || !originalDimensions.height || (!needsResize && !needsFormatConversion)) {
    return { file, dimensions: originalDimensions };
  }

  const scale = needsResize
    ? Math.min(1, API_MAX_IMAGE_EDGE / Math.max(originalDimensions.width, originalDimensions.height))
    : 1;
  const width = Math.round(originalDimensions.width * scale);
  const height = Math.round(originalDimensions.height * scale);

  const image = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });
  URL.revokeObjectURL(url);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });

  if (!blob) return { file, dimensions: originalDimensions };

  const optimizedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: file.lastModified || Date.now(),
  });

  return {
    file: optimizedFile,
    dimensions: { width, height },
  };
}

async function setupCloudClient() {
  if (!isCloudConfigured()) {
    updateSyncStatus();
    return false;
  }

  if (cloud.ready) return true;

  cloud.loading = true;
  updateSyncStatus();
  try {
    if (cloud.provider === "api") {
      cloud.ready = true;
      cloud.error = "";
      return true;
    }

    const { createClient } = await import(SUPABASE_MODULE_URL);
    cloud.client = createClient(cloud.url, cloud.anonKey);
    cloud.ready = true;
    cloud.error = "";
    return true;
  } catch (error) {
    console.warn("クラウドへの接続に失敗しました。", error);
    cloud.ready = false;
    cloud.error = "クラウドへの接続に失敗しました。";
    return false;
  } finally {
    cloud.loading = false;
    updateSyncStatus();
  }
}

function cloudStoragePath(photoId, fileName) {
  const cleanedName = safeFileName(fileName || "memory-photo");
  return `${cloud.albumId}/${photoId}-${cleanedName}`;
}

async function signedPhotoUrl(storagePath) {
  const { data, error } = await cloud.client
    .storage
    .from(cloud.bucket)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (error) throw error;
  return data.signedUrl;
}

async function uploadPhotoToCloud(file, dimensions, photoId = generatePhotoId()) {
  if (cloud.provider === "api") {
    const { file: uploadFile, dimensions: uploadDimensions } = await optimizeImageForApi(file);
    const dataUrl = await blobToDataUrl(uploadFile);
    const response = await fetch(apiUrl("/api/photos"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: photoId,
        albumId: cloud.albumId,
        name: uploadFile.name,
        type: uploadFile.type,
        date: uploadFile.lastModified || file.lastModified || Date.now(),
        width: uploadDimensions.width || dimensions.width,
        height: uploadDimensions.height || dimensions.height,
        dataUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      ...result.photo,
      source: "cloud",
      url: apiUrl(`/api/photos/${encodeURIComponent(result.photo.id)}`),
    };
  }

  const storagePath = cloudStoragePath(photoId, file.name);
  const sortTime = file.lastModified || Date.now();

  const { error: uploadError } = await cloud.client
    .storage
    .from(cloud.bucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const record = {
    id: photoId,
    album_id: cloud.albumId,
    name: file.name,
    type: file.type,
    sort_time: sortTime,
    width: dimensions.width,
    height: dimensions.height,
    storage_path: storagePath,
  };

  const { error: insertError } = await cloud.client
    .from(cloud.table)
    .insert(record);

  if (insertError) {
    await cloud.client.storage.from(cloud.bucket).remove([storagePath]);
    throw insertError;
  }

  return {
    id: photoId,
    name: record.name,
    type: record.type,
    date: record.sort_time,
    width: record.width,
    height: record.height,
    storagePath,
    source: "cloud",
    url: await signedPhotoUrl(storagePath),
  };
}

async function loadCloudPhotos({ keepLocal = true } = {}) {
  if (!cloud.ready) return;

  cloud.loading = true;
  updateSyncStatus("クラウドから写真を読み込んでいます。");
  try {
    if (cloud.provider === "api") {
      const response = await fetch(apiUrl("/api/photos"));
      if (!response.ok) throw new Error(`Load failed: ${response.status}`);
      const result = await response.json();
      const cloudPhotos = (result.photos || []).map((photo) => ({
        ...photo,
        source: "cloud",
        url: apiUrl(`/api/photos/${encodeURIComponent(photo.id)}`),
      }));
      const cloudIds = new Set(cloudPhotos.map((photo) => photo.id));
      const unsyncedLocal = keepLocal
        ? localOnlyPhotos().filter((photo) => !cloudIds.has(photo.id))
        : [];

      revokePhotoUrls();
      state.photos = [...cloudPhotos, ...unsyncedLocal];
      state.currentIndex = 0;
      state.activeCollection = "all";
      render();
      updateSyncStatus(unsyncedLocal.length ? `${cloudPhotos.length}枚を同期済み、${unsyncedLocal.length}枚はこの端末のみです。` : `${cloudPhotos.length}枚をクラウドから表示しています。`);
      return;
    }

    const { data, error } = await cloud.client
      .from(cloud.table)
      .select("id,name,type,sort_time,width,height,storage_path")
      .eq("album_id", cloud.albumId)
      .order("sort_time", { ascending: true });

    if (error) throw error;

    const cloudPhotos = await Promise.all((data || []).map(async (row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      date: row.sort_time,
      width: row.width || 0,
      height: row.height || 0,
      storagePath: row.storage_path,
      source: "cloud",
      url: await signedPhotoUrl(row.storage_path),
    })));

    const cloudIds = new Set(cloudPhotos.map((photo) => photo.id));
    const unsyncedLocal = keepLocal
      ? localOnlyPhotos().filter((photo) => !cloudIds.has(photo.id))
      : [];

    revokePhotoUrls();
    state.photos = [...cloudPhotos, ...unsyncedLocal];
    state.currentIndex = 0;
    state.activeCollection = "all";
    render();
    updateSyncStatus(unsyncedLocal.length ? `${cloudPhotos.length}枚を同期済み、${unsyncedLocal.length}枚はこの端末のみです。` : `${cloudPhotos.length}枚をクラウドから表示しています。`);
  } catch (error) {
    console.warn("クラウド写真の読み込みに失敗しました。", error);
    cloud.error = "クラウド写真の読み込みに失敗しました。";
    updateSyncStatus(cloud.error);
  } finally {
    cloud.loading = false;
    updateSyncStatus();
  }
}

async function syncLocalPhotosToCloud() {
  if (!cloud.ready) return;

  const photos = localOnlyPhotos();
  if (!photos.length) {
    updateSyncStatus();
    return;
  }

  cloud.loading = true;
  updateSyncStatus(`${photos.length}枚をクラウドへ同期しています。`);
  let synced = 0;
  try {
    for (const photo of photos) {
      const file = new File([photo.blob], photo.name, {
        type: photo.type || photo.blob.type || "image/jpeg",
        lastModified: photo.date || Date.now(),
      });
      await uploadPhotoToCloud(file, { width: photo.width, height: photo.height }, photo.id);
      synced += 1;
    }
    await loadCloudPhotos({ keepLocal: false });
    updateShareStatus(`${synced}枚をクラウドへ同期しました`);
  } catch (error) {
    console.warn("ローカル写真の同期に失敗しました。", error);
    updateShareStatus("同期に失敗しました");
  } finally {
    cloud.loading = false;
    updateSyncStatus();
  }
}

async function deleteCloudPhotos() {
  if (!cloud.ready) return;

  if (cloud.provider === "api") {
    if (!cloud.adminToken) {
      throw new Error("Cloud delete requires an admin token");
    }

    const response = await fetch(apiUrl("/api/photos"), {
      method: "DELETE",
      headers: cloud.adminToken ? { "X-Admin-Token": cloud.adminToken } : {},
    });
    if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
    return;
  }

  const storagePaths = state.photos
    .filter((photo) => photo.source === "cloud" && photo.storagePath)
    .map((photo) => photo.storagePath);

  if (storagePaths.length) {
    const { error: storageError } = await cloud.client
      .storage
      .from(cloud.bucket)
      .remove(storagePaths);
    if (storageError) throw storageError;
  }

  const { error: dbError } = await cloud.client
    .from(cloud.table)
    .delete()
    .eq("album_id", cloud.albumId);

  if (dbError) throw dbError;
}

async function deleteCloudPhoto(photo) {
  if (!cloud.ready || photo.source !== "cloud") return;

  if (cloud.provider === "api") {
    const response = await fetch(apiUrl(`/api/photos/${encodeURIComponent(photo.id)}`), {
      method: "DELETE",
      headers: cloud.adminToken ? { "X-Admin-Token": cloud.adminToken } : {},
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete failed: ${response.status}`);
    }
    return;
  }

  if (photo.storagePath) {
    const { error: storageError } = await cloud.client
      .storage
      .from(cloud.bucket)
      .remove([photo.storagePath]);
    if (storageError) throw storageError;
  }

  const { error: dbError } = await cloud.client
    .from(cloud.table)
    .delete()
    .eq("album_id", cloud.albumId)
    .eq("id", photo.id);

  if (dbError) throw dbError;
}

async function deleteSelectedPhotos() {
  const photos = selectedPhotos();
  if (!photos.length) return;

  const message = `${photos.length}枚の写真を削除しますか？`;
  if (!window.confirm(message)) return;

  pauseMemory();
  cloud.loading = photos.some((photo) => photo.source === "cloud");
  updateSelectionControls();
  updateSyncStatus(`${photos.length}枚を削除しています。`);

  const photoIds = new Set(photos.map((photo) => photo.id));
  try {
    for (const photo of photos) {
      await deleteCloudPhoto(photo);
    }

    await deleteLocalPhotos(photos.filter((photo) => photo.blob).map((photo) => photo.id));
    photos.forEach((photo) => {
      if (photo.url) URL.revokeObjectURL(photo.url);
    });

    state.photos = state.photos.filter((photo) => !photoIds.has(photo.id));
    state.selectedIds.clear();
    state.selectionMode = false;
    state.currentIndex = Math.min(state.currentIndex, Math.max(0, state.photos.length - 1));
    if (state.activeCollection !== "all" && !visiblePhotos().length) {
      state.activeCollection = "all";
    }
    render();
    updateShareStatus(`${photos.length}枚を削除しました`);
  } catch (error) {
    console.warn("選択した写真の削除に失敗しました。", error);
    updateShareStatus("写真の削除に失敗しました");
  } finally {
    cloud.loading = false;
    updateSyncStatus();
    updateSelectionControls();
  }
}

async function importFiles(fileList) {
  const files = Array.from(fileList).filter(isSupportedImageFile);
  if (!files.length) return;

  pauseMemory();
  const firstImportedId = generatePhotoId();
  for (const [index, file] of files.entries()) {
    const dimensions = await getImageDimensions(file);
    const photoId = index === 0 ? firstImportedId : generatePhotoId();

    if (cloud.ready) {
      try {
        state.photos.push(await uploadPhotoToCloud(file, dimensions, photoId));
        continue;
      } catch (error) {
        console.warn("クラウドへのアップロードに失敗しました。端末内に保存します。", error);
        updateShareStatus("クラウド保存に失敗したため端末内に保存しました");
      }
    }

    const photo = {
      id: photoId,
      name: file.name,
      type: file.type,
      date: file.lastModified || Date.now(),
      width: dimensions.width,
      height: dimensions.height,
      blob: file,
      source: "local",
    };
    try {
      await savePhoto(photo);
    } catch (error) {
      console.warn("写真のブラウザ保存に失敗しました。表示はこのセッション内で続けます。", error);
    }
    state.photos.push(photo);
  }

  sortPhotos();
  state.currentIndex = Math.max(0, state.photos.findIndex((photo) => photo.id === firstImportedId));
  state.activeCollection = "all";
  render();
  updateSyncStatus();
}

function updateShareStatus(message) {
  els.shareStatus.textContent = message;
  window.clearTimeout(updateShareStatus.timer);
  updateShareStatus.timer = window.setTimeout(() => {
    els.shareStatus.textContent = "";
  }, 3600);
}

function safeFileName(value) {
  return (value || DEFAULT_ALBUM_NAME)
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48) || "date-memory";
}

async function getPhotoBlob(photo) {
  if (photo.blob) return photo.blob;
  const url = createPhotoUrl(photo);
  if (!url) throw new Error("Photo URL is missing");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Photo download failed");
  return response.blob();
}

async function exportAlbum() {
  if (!state.photos.length) return;

  const photos = await Promise.all(state.photos.map(async (photo) => ({
    id: photo.id,
    name: photo.name,
    type: photo.type || photo.blob?.type,
    date: photo.date,
    width: photo.width,
    height: photo.height,
    dataUrl: await blobToDataUrl(await getPhotoBlob(photo)),
  })));

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    albumName: els.albumName.value.trim() || DEFAULT_ALBUM_NAME,
    photos,
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(payload.albumName)}.memory-album.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  updateShareStatus("アルバムを書き出しました");
}

async function importAlbumFile(file) {
  if (!file) return;

  pauseMemory();
  try {
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.photos)) throw new Error("Missing photos");

    const existingIds = new Set(state.photos.map((photo) => photo.id));
    let firstAddedId = "";
    let addedCount = 0;

    if (payload.albumName) {
      els.albumName.value = payload.albumName;
      savePreferences();
    }

    for (const item of payload.photos) {
      if (!item?.dataUrl) continue;

      const id = item.id || generatePhotoId();
      if (existingIds.has(id)) continue;

      const blob = dataUrlToBlob(item.dataUrl);
      if (cloud.ready) {
        const file = new File([blob], item.name || "memory-photo", {
          type: item.type || blob.type || "image/jpeg",
          lastModified: Number(item.date) || Date.now(),
        });
        state.photos.push(await uploadPhotoToCloud(file, {
          width: Number(item.width) || 0,
          height: Number(item.height) || 0,
        }, id));
        existingIds.add(id);
        firstAddedId ||= id;
        addedCount += 1;
        continue;
      }

      const photo = {
        id,
        name: item.name || "memory-photo",
        type: item.type || blob.type,
        date: Number(item.date) || Date.now(),
        width: Number(item.width) || 0,
        height: Number(item.height) || 0,
        blob,
        source: "local",
      };

      try {
        await savePhoto(photo);
      } catch (error) {
        console.warn("読み込んだ写真のブラウザ保存に失敗しました。", error);
      }
      state.photos.push(photo);
      existingIds.add(id);
      firstAddedId ||= id;
      addedCount += 1;
    }

    sortPhotos();
    if (firstAddedId) {
      state.currentIndex = Math.max(0, state.photos.findIndex((photo) => photo.id === firstAddedId));
    }
    state.activeCollection = "all";
    render();
    updateShareStatus(addedCount ? `${addedCount}枚読み込みました` : "追加済みのアルバムです");
  } catch (error) {
    console.warn("アルバムの読み込みに失敗しました。", error);
    updateShareStatus("読み込めませんでした");
  }
}

async function loadInitialPhotos() {
  try {
    state.photos = (await readAllPhotos()).map((photo) => ({
      ...photo,
      source: photo.source || "local",
    }));
  } catch (error) {
    console.warn("保存済み写真の読み込みに失敗しました。", error);
    state.photos = [];
  }
  sortPhotos();
  render();
  updateSyncStatus();

  if (await setupCloudClient()) {
    await loadCloudPhotos({ keepLocal: true });
  }
}

function applyMood(mood) {
  state.mood = mood;
  document.body.classList.remove("mood-day", "mood-night");
  if (mood !== "cinema") document.body.classList.add(`mood-${mood}`);

  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.mood === mood);
  });
  savePreferences();
}

function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_KEY)) || {};
  } catch {
    return {};
  }
}

function savePreferences() {
  const preferences = {
    albumName: els.albumName.value,
    speed: els.speedRange.value,
    mood: state.mood,
    themeDark: document.body.classList.contains("theme-dark"),
  };
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

function applyPreferences() {
  const preferences = loadPreferences();
  if (preferences.albumName && preferences.albumName !== "ふたりの時間") {
    els.albumName.value = preferences.albumName;
  } else {
    els.albumName.value = DEFAULT_ALBUM_NAME;
  }
  if (preferences.speed) {
    els.speedRange.value = preferences.speed;
    state.speed = Number(preferences.speed) * 1000;
    els.speedValue.textContent = `${preferences.speed}秒`;
  }
  if (preferences.themeDark) document.body.classList.add("theme-dark");
  applyMood(preferences.mood || "cinema");
}

els.input.addEventListener("change", (event) => {
  importFiles(event.target.files);
  event.target.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("is-dragging");
  });
});

els.dropZone.addEventListener("drop", (event) => {
  importFiles(event.dataTransfer.files);
});

els.playBtn.addEventListener("click", toggleMemory);
els.nextBtn.addEventListener("click", () => {
  pauseMemory();
  nextPhoto();
});
els.prevBtn.addEventListener("click", () => {
  pauseMemory();
  previousPhoto();
});

els.albumName.addEventListener("input", () => {
  els.memoryTitle.textContent = els.albumName.value.trim() || DEFAULT_ALBUM_NAME;
  savePreferences();
});

els.speedRange.addEventListener("input", () => {
  state.speed = Number(els.speedRange.value) * 1000;
  els.speedValue.textContent = `${els.speedRange.value}秒`;
  if (state.isPlaying) {
    pauseMemory();
    playMemory();
  }
  savePreferences();
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => applyMood(button.dataset.mood));
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
    renderThumbs();
  });
});

els.themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("theme-dark");
  savePreferences();
});

els.exportBtn.addEventListener("click", exportAlbum);

els.syncNowBtn.addEventListener("click", syncLocalPhotosToCloud);

els.selectModeBtn.addEventListener("click", () => {
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) state.selectedIds.clear();
  pauseMemory();
  render();
});

els.deleteSelectedBtn.addEventListener("click", deleteSelectedPhotos);

els.albumImportInput.addEventListener("change", (event) => {
  importAlbumFile(event.target.files[0]);
  event.target.value = "";
});

els.clearBtn.addEventListener("click", () => {
  if (cloud.ready && hasCloudPhotos() && !canDeleteEntireCloudAlbum()) {
    updateShareStatus("共有アルバムの削除には管理者設定が必要です");
    return;
  }

  if (typeof els.confirmDialog.showModal === "function") {
    els.confirmDialog.showModal();
  }
});

els.confirmClear.addEventListener("click", async () => {
  pauseMemory();
  if (cloud.ready) {
    try {
      await deleteCloudPhotos();
    } catch (error) {
      console.warn("クラウド写真の削除に失敗しました。", error);
      updateShareStatus("クラウド写真の削除に失敗しました");
      return;
    }
  }

  try {
    await clearPhotos();
  } catch (error) {
    console.warn("保存済み写真の削除に失敗しました。", error);
  }
  revokePhotoUrls();
  state.photos = [];
  state.currentIndex = 0;
  state.activeCollection = "all";
  render();
  updateSyncStatus("写真を削除しました。");
});

window.addEventListener("beforeunload", () => {
  revokePhotoUrls();
  savePreferences();
});

applyPreferences();
loadInitialPhotos();
