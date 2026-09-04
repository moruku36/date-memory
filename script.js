const DB_NAME = "couple-memory-album";
const DB_VERSION = 1;
const STORE_NAME = "photos";
const PREFERENCES_KEY = "couple-memory-preferences";
const DEFAULT_ALBUM_NAME = "デートのメモリー";
const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const CLOUD_CONFIG = window.DATE_MEMORY_CLOUD || {};
const API_OPTIMIZE_THRESHOLD_BYTES = 1.2 * 1024 * 1024;
const API_MAX_IMAGE_EDGE = 1800;
const API_IMAGE_QUALITY = 0.80;
const API_THUMBNAIL_MAX_IMAGE_EDGE = 480;
const API_THUMBNAIL_QUALITY = 0.70;
const THUMB_BATCH_SIZE = 36;
const CLOUD_PHOTO_CACHE_PREFIX = "date-memory-cloud-cache-v1";
const API_WEB_FRIENDLY_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

let initialPhotoSelectedId = null;

const state = {
  photos: [],
  currentIndex: -1,
  activeCollection: "all",
  isPlaying: false,
  timer: null,
  speed: 5000,
  view: "grid",
  mood: "cinema",
  selectionMode: false,
  selectedIds: new Set(),
  renderedThumbCount: THUMB_BATCH_SIZE,
  thumbObserver: null,
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
  memoryStage: document.getElementById("memoryStage"),
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
  zipExportBtn: document.getElementById("zipExportBtn"),
  shareStatus: document.getElementById("shareStatus"),
  syncBadge: document.getElementById("syncBadge"),
  syncMessage: document.getElementById("syncMessage"),
  syncNowBtn: document.getElementById("syncNowBtn"),
  clearBtn: document.getElementById("clearBtn"),
  confirmDialog: document.getElementById("confirmDialog"),
  confirmClear: document.getElementById("confirmClear"),
  themeToggle: document.getElementById("themeToggle"),
  bgmToggle: document.getElementById("bgmToggle"),
  fullscreenToggle: document.getElementById("fullscreenToggle"),
  mapOpenBtn: document.getElementById("mapOpenBtn"),
  mapOpenSideBtn: document.getElementById("mapOpenSideBtn"),
  onThisDayBanner: document.getElementById("onThisDayBanner"),
  onThisDaySubtitle: document.getElementById("onThisDaySubtitle"),
  playOnThisDayBtn: document.getElementById("playOnThisDayBtn"),
  favoriteBtn: document.getElementById("favoriteBtn"),
  zoomBtn: document.getElementById("zoomBtn"),
  infoBtn: document.getElementById("infoBtn"),
  photoMemoContainer: document.getElementById("photoMemoContainer"),
  photoMemoText: document.getElementById("photoMemoText"),
  photoMemoEditBox: document.getElementById("photoMemoEditBox"),
  photoMemoInput: document.getElementById("photoMemoInput"),
  photoMemoSaveBtn: document.getElementById("photoMemoSaveBtn"),
  photoMemoCancelBtn: document.getElementById("photoMemoCancelBtn"),
  restoreSelectedBtn: document.getElementById("restoreSelectedBtn"),
  deleteBtnLabel: document.getElementById("deleteBtnLabel"),
  mapModal: document.getElementById("mapModal"),
  mapCloseBtn: document.getElementById("mapCloseBtn"),
  mapContainer: document.getElementById("mapContainer"),
  mapPinCount: document.getElementById("mapPinCount"),
  infoModal: document.getElementById("infoModal"),
  infoCloseBtn: document.getElementById("infoCloseBtn"),
  infoDate: document.getElementById("infoDate"),
  infoDayOfWeek: document.getElementById("infoDayOfWeek"),
  infoCamera: document.getElementById("infoCamera"),
  infoDimensions: document.getElementById("infoDimensions"),
  infoSize: document.getElementById("infoSize"),
  infoLocationText: document.getElementById("infoLocationText"),
  infoShowOnMapBtn: document.getElementById("infoShowOnMapBtn"),
  bgmToast: document.getElementById("bgmToast"),
  bgmToastText: document.getElementById("bgmToastText"),
  uploadProgressModal: document.getElementById("uploadProgressModal"),
  progressTitle: document.getElementById("progressTitle"),
  progressSubtitle: document.getElementById("progressSubtitle"),
  progressBarFill: document.getElementById("progressBarFill"),
  lightboxModal: document.getElementById("lightboxModal"),
  lightboxImg: document.getElementById("lightboxImg"),
  lightboxCloseBtn: document.getElementById("lightboxCloseBtn"),
  lockStatusBadge: document.getElementById("lockStatusBadge"),
  lockConfigBtn: document.getElementById("lockConfigBtn"),
  lockConfigBtnText: document.getElementById("lockConfigBtnText"),
  lockNowBtn: document.getElementById("lockNowBtn"),
  lockScreenModal: document.getElementById("lockScreenModal"),
  lockInstruction: document.getElementById("lockInstruction"),
  lockBioBtn: document.getElementById("lockBioBtn"),
  pinEntryContainer: document.getElementById("pinEntryContainer"),
  pinDots: document.getElementById("pinDots"),
  pinKeypad: document.getElementById("pinKeypad"),
  pinBioSwitchBtn: document.getElementById("pinBioSwitchBtn"),
  pinDeleteBtn: document.getElementById("pinDeleteBtn"),
  togglePinInputBtn: document.getElementById("togglePinInputBtn"),
  lockErrorMsg: document.getElementById("lockErrorMsg"),
  lockConfigModal: document.getElementById("lockConfigModal"),
  closeLockConfigBtn: document.getElementById("closeLockConfigBtn"),
  lockEnabledToggle: document.getElementById("lockEnabledToggle"),
  lockOptionsArea: document.getElementById("lockOptionsArea"),
  registerBioBtn: document.getElementById("registerBioBtn"),
  bioStatusDesc: document.getElementById("bioStatusDesc"),
  changePinBtn: document.getElementById("changePinBtn"),
  lockGracePeriodSelect: document.getElementById("lockGracePeriodSelect"),
  pinSetupForm: document.getElementById("pinSetupForm"),
  pinSetupTitle: document.getElementById("pinSetupTitle"),
  newPinInput: document.getElementById("newPinInput"),
  cancelPinSetupBtn: document.getElementById("cancelPinSetupBtn"),
  savePinSetupBtn: document.getElementById("savePinSetupBtn"),
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

function cloudPhotoCacheKey() {
  if (cloud.provider !== "api") return "";
  const baseUrl = cloud.apiBaseUrl || window.location.origin;
  return `${CLOUD_PHOTO_CACHE_PREFIX}:${baseUrl}:${cloud.albumId}`;
}

function cachedCloudPhoto(photo) {
  return {
    id: photo.id,
    name: photo.name,
    type: photo.type,
    date: photo.date,
    width: photo.width || 0,
    height: photo.height || 0,
    hasThumbnail: Boolean(photo.hasThumbnail),
    updatedAt: photo.updatedAt || photo.date || Date.now(),
  };
}

function apiPhotoUrl(photo, variant = "full") {
  const params = {
    v: photo.updatedAt || photo.date || Date.now(),
  };
  if (variant === "thumb") params.variant = "thumb";
  return apiUrl(`/api/photos/${encodeURIComponent(photo.id)}`, params);
}

function hydrateApiPhoto(photo) {
  const normalized = {
    ...photo,
    date: Number(photo.date) || Date.now(),
    updatedAt: Number(photo.updatedAt) || Number(photo.date) || Date.now(),
    source: "cloud",
  };

  return {
    ...normalized,
    url: apiPhotoUrl(normalized),
    thumbnailUrl: apiPhotoUrl(normalized, "thumb"),
  };
}

function readCachedCloudPhotos() {
  const cacheKey = cloudPhotoCacheKey();
  if (!cacheKey) return [];

  try {
    const payload = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    if (!Array.isArray(payload.photos)) return [];
    return payload.photos.filter((photo) => photo.id);
  } catch {
    return [];
  }
}

function writeCloudPhotoCache(photos) {
  const cacheKey = cloudPhotoCacheKey();
  if (!cacheKey) return;

  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      cachedAt: Date.now(),
      photos: photos.filter((photo) => photo.source === "cloud").map(cachedCloudPhoto),
    }));
  } catch (error) {
    console.warn("写真一覧キャッシュの保存に失敗しました。", error);
  }
}

function clearCloudPhotoCache() {
  const cacheKey = cloudPhotoCacheKey();
  if (!cacheKey) return;

  try {
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn("写真一覧キャッシュの削除に失敗しました。", error);
  }
}

function restoreCachedCloudPhotos({ keepLocal = true } = {}) {
  if (cloud.provider !== "api") return false;

  const cachedPhotos = readCachedCloudPhotos().map(hydrateApiPhoto);
  if (!cachedPhotos.length) return false;

  const cachedIds = new Set(cachedPhotos.map((photo) => photo.id));
  const unsyncedLocal = keepLocal
    ? localOnlyPhotos().filter((photo) => !cachedIds.has(photo.id))
    : [];

  state.photos = [...cachedPhotos, ...unsyncedLocal];
  state.activeCollection = "all";
  if (!initialPhotoSelectedId) {
    setRandomCurrentIndex();
    initialPhotoSelectedId = state.photos[state.currentIndex]?.id;
  } else {
    const existingIdx = state.photos.findIndex((p) => p.id === initialPhotoSelectedId);
    if (existingIdx >= 0) state.currentIndex = existingIdx;
  }
  render();
  updateSyncStatus("前回の写真を先に表示しながら、最新状態を確認しています。");
  return true;
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
  const isTrash = state.activeCollection === "trash";
  els.selectModeBtn.disabled = !visiblePhotos().length;
  els.selectModeBtn.classList.toggle("active", state.selectionMode);
  els.selectModeBtn.setAttribute("aria-pressed", state.selectionMode ? "true" : "false");
  els.selectModeLabel.textContent = state.selectionMode ? "完了" : "選択";
  els.selectionActions.hidden = !state.selectionMode;
  els.selectionCount.textContent = `${selectedCount}枚選択中`;
  els.deleteSelectedBtn.disabled = selectedCount === 0 || cloud.loading;
  if (els.deleteBtnLabel) {
    els.deleteBtnLabel.textContent = isTrash ? "完全に削除" : "削除";
  }
  if (els.restoreSelectedBtn) {
    els.restoreSelectedBtn.hidden = !isTrash;
    els.restoreSelectedBtn.disabled = selectedCount === 0 || cloud.loading;
  }
}

function updateSyncStatus(message) {
  if (!els.syncBadge && !els.syncMessage && !els.syncNowBtn) return;
  const localCount = localOnlyPhotos().length;

  if (!isCloudConfigured()) {
    if (els.syncBadge) els.syncBadge.textContent = "この端末のみ";
    if (els.syncMessage) els.syncMessage.textContent = message || "クラウド未設定です。MongoDB APIを設定すると、PCとスマホで同じ写真を見られます。";
    if (els.syncNowBtn) els.syncNowBtn.disabled = true;
    return;
  }

  if (cloud.loading) {
    if (els.syncBadge) els.syncBadge.textContent = "同期中";
    if (els.syncMessage) els.syncMessage.textContent = message || "クラウドと同期しています。";
    if (els.syncNowBtn) els.syncNowBtn.disabled = true;
    return;
  }

  if (!cloud.ready) {
    if (els.syncBadge) els.syncBadge.textContent = "未接続";
    if (els.syncMessage) els.syncMessage.textContent = message || cloud.error || "クラウドに接続できませんでした。";
    if (els.syncNowBtn) els.syncNowBtn.disabled = true;
    return;
  }

  if (els.syncBadge) els.syncBadge.textContent = "クラウド同期";
  if (els.syncMessage) els.syncMessage.textContent = message || `${cloudPhotoCount()}枚をクラウドから表示しています。`;
  if (els.syncNowBtn) els.syncNowBtn.disabled = localCount === 0;
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

function createObjectUrl(photo, urlKey, blobKey) {
  if (photo[urlKey]) return photo[urlKey];
  if (!photo[blobKey]) return "";
  photo[urlKey] = URL.createObjectURL(photo[blobKey]);
  return photo[urlKey];
}

function createPhotoUrl(photo) {
  return createObjectUrl(photo, "url", "blob");
}

function createThumbnailUrl(photo) {
  if (photo.thumbnailUrl) return photo.thumbnailUrl;
  if (photo.thumbnailBlob) return createObjectUrl(photo, "thumbnailUrl", "thumbnailBlob");
  return createPhotoUrl(photo);
}

function revokeObjectUrl(url) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
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
    revokeObjectUrl(photo.url);
    revokeObjectUrl(photo.thumbnailUrl);
    if (photo.url?.startsWith("blob:")) photo.url = "";
    if (photo.thumbnailUrl?.startsWith("blob:")) photo.thumbnailUrl = "";
  });
}

function activePhotos() {
  return state.photos.filter((p) => !p.deletedAt);
}

function trashPhotos() {
  return state.photos.filter((p) => Boolean(p.deletedAt));
}

function getOnThisDayPhotos() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  const currentYear = now.getFullYear();

  return activePhotos().filter((photo) => {
    const d = new Date(photo.date);
    return d.getMonth() === currentMonth && d.getDate() === currentDate && d.getFullYear() < currentYear;
  });
}

function visiblePhotos() {
  if (state.activeCollection === "trash") {
    return trashPhotos();
  }
  const base = activePhotos();
  if (state.activeCollection === "all") return base;
  if (state.activeCollection === "favorites") {
    return base.filter((p) => p.favorite);
  }
  if (state.activeCollection === "on_this_day") {
    return getOnThisDayPhotos();
  }
  return base.filter((photo) => formatMonth(photo.date) === state.activeCollection);
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

function setRandomCurrentIndex() {
  const photos = visiblePhotos();
  if (!photos.length) {
    state.currentIndex = 0;
    return;
  }
  const randomIndex = Math.floor(Math.random() * photos.length);
  const chosen = photos[randomIndex];
  state.currentIndex = state.photos.findIndex((photo) => photo.id === chosen.id);
  if (state.currentIndex < 0) state.currentIndex = 0;
}

function buildCollections() {
  const active = activePhotos();
  const collections = [
    { id: "all", label: "すべての写真", count: active.length, cover: active[0] },
  ];

  const favPhotos = active.filter((p) => p.favorite);
  if (favPhotos.length > 0) {
    collections.push({
      id: "favorites",
      label: "❤️ お気に入り",
      count: favPhotos.length,
      cover: favPhotos[0],
    });
  }

  const onThisDayPhotos = getOnThisDayPhotos();
  if (onThisDayPhotos.length > 0) {
    collections.push({
      id: "on_this_day",
      label: "✨ 過去の今日の思い出",
      count: onThisDayPhotos.length,
      cover: onThisDayPhotos[0],
    });
  }

  const groups = new Map();
  active.forEach((photo) => {
    const month = formatMonth(photo.date);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(photo);
  });

  Array.from(groups, ([id, photos]) => {
    collections.push({
      id,
      label: id,
      count: photos.length,
      cover: photos[0],
    });
  });

  const trash = trashPhotos();
  if (trash.length > 0) {
    collections.push({
      id: "trash",
      label: "🗑️ 最近削除した項目",
      count: trash.length,
      cover: trash[0],
    });
  }

  return collections;
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
    img.loading = "lazy";
    img.decoding = "async";
    img.src = createThumbnailUrl(collection.cover);
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
      state.renderedThumbCount = THUMB_BATCH_SIZE;
      if (collection.id === "all") {
        setRandomCurrentIndex();
      } else {
        const visible = visiblePhotos();
        const first = visible[0];
        state.currentIndex = Math.max(0, state.photos.findIndex((photo) => photo.id === first?.id));
      }
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
  if (els.clearBtn) els.clearBtn.disabled = !hasPhotos;
  els.exportBtn.disabled = !hasPhotos;

  if (!hasPhotos) {
    els.stageBg.style.backgroundImage = "";
    els.photoCount.textContent = "0枚";
    return;
  }

  if (state.currentIndex < 0 || state.currentIndex >= state.photos.length) {
    state.currentIndex = Math.floor(Math.random() * state.photos.length);
  }

  const current = state.photos[state.currentIndex] || state.photos[0];
  const url = createPhotoUrl(current);
  const backgroundUrl = createThumbnailUrl(current) || url;

  const isSamePhoto = els.currentPhoto.dataset.photoId === current.id;
  if (!isSamePhoto) {
    els.currentPhoto.dataset.photoId = current.id;
    els.currentPhoto.src = url;
    els.currentPhoto.alt = current.name;
    els.currentPhoto.decoding = "async";
    els.currentPhoto.style.animation = "none";
    requestAnimationFrame(() => {
      els.currentPhoto.style.animation = "";
    });
  }

  els.stageBg.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.34)), url("${backgroundUrl}")`;
  els.memoryDate.textContent = formatDate(current.date);
  els.memoryTitle.textContent = els.albumName.value.trim() || DEFAULT_ALBUM_NAME;

  const photos = visiblePhotos();
  els.memoryCounter.textContent = `${currentVisibleIndex() + 1} / ${photos.length}`;
  els.photoCount.textContent = `${state.photos.length}枚`;

  // お気に入り状態
  if (els.favoriteBtn) {
    els.favoriteBtn.classList.toggle("is-favorite", Boolean(current.favorite));
  }
  // メモ状態
  if (els.photoMemoText) {
    els.photoMemoText.textContent = current.memo ? `💬 ${current.memo}` : "💬 メモを追加...";
    els.photoMemoText.hidden = false;
  }
  if (els.photoMemoEditBox) {
    els.photoMemoEditBox.hidden = true;
  }
  if (els.photoMemoInput) {
    els.photoMemoInput.value = current.memo || "";
  }
  if (els.zipExportBtn) {
    els.zipExportBtn.disabled = !hasPhotos;
  }

  // 過去の今日バナー更新
  const onThisDay = getOnThisDayPhotos();
  if (els.onThisDayBanner) {
    els.onThisDayBanner.hidden = onThisDay.length === 0;
    if (onThisDay.length > 0 && els.onThisDaySubtitle) {
      els.onThisDaySubtitle.textContent = `過去の今日撮影された写真が ${onThisDay.length} 枚あります`;
    }
  }

  els.heroPhoto.classList.remove("portrait", "landscape");
  if (current.width && current.height) {
    els.heroPhoto.classList.add(current.height > current.width ? "portrait" : "landscape");
  }

  preloadUpcomingPhotos();
}

function preloadUpcomingPhotos() {
  const photos = visiblePhotos();
  if (!photos.length) return;
  const currentIdx = currentVisibleIndex();
  const upcomingIndices = [
    (currentIdx + 1) % photos.length,
    (currentIdx + 2) % photos.length,
    (currentIdx - 1 + photos.length) % photos.length,
  ];

  upcomingIndices.forEach((idx) => {
    const photo = photos[idx];
    if (photo) {
      const url = createPhotoUrl(photo);
      if (url) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      }
    }
  });
}

function renderThumbItem(photo, index) {
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
  img.loading = "lazy";
  img.decoding = "async";
  img.src = createThumbnailUrl(photo);
  img.alt = photo.name;

  if (photo.favorite) {
    const favBadge = document.createElement("span");
    favBadge.className = "thumb-fav-badge";
    favBadge.textContent = "❤️";
    button.append(favBadge);
  }

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

  return button;
}

function renderThumbs() {
  const photos = visiblePhotos();
  els.thumbGrid.className = `thumb-grid ${state.view}`;

  if (state.thumbObserver) {
    state.thumbObserver.disconnect();
    state.thumbObserver = null;
  }

  const currentVisIdx = currentVisibleIndex();
  if (currentVisIdx >= state.renderedThumbCount) {
    state.renderedThumbCount = Math.min(
      photos.length,
      Math.ceil((currentVisIdx + 1) / THUMB_BATCH_SIZE) * THUMB_BATCH_SIZE
    );
  }

  const limit = Math.min(photos.length, state.renderedThumbCount);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < limit; index++) {
    fragment.append(renderThumbItem(photos[index], index));
  }

  if (limit < photos.length) {
    const sentinel = document.createElement("div");
    sentinel.className = "grid-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    fragment.append(sentinel);

    if ("IntersectionObserver" in window) {
      state.thumbObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          state.renderedThumbCount = Math.min(photos.length, state.renderedThumbCount + THUMB_BATCH_SIZE);
          renderThumbs();
        }
      }, { rootMargin: "400px" });
      state.thumbObserver.observe(sentinel);
    }
  }

  els.thumbGrid.innerHTML = "";
  els.thumbGrid.append(fragment);
}

function render() {
  const photos = visiblePhotos();
  if (photos.length > 0 && (state.currentIndex < 0 || state.currentIndex >= state.photos.length)) {
    const randomIndex = Math.floor(Math.random() * photos.length);
    const chosen = photos[randomIndex];
    state.currentIndex = state.photos.findIndex((p) => p.id === chosen.id);
    if (state.currentIndex < 0) state.currentIndex = 0;
  }

  const current = state.photos[state.currentIndex];
  sortPhotos();
  pruneSelection();
  if (current) {
    const nextIndex = state.photos.findIndex((photo) => photo.id === current.id);
    if (nextIndex >= 0) state.currentIndex = nextIndex;
  }
  if (state.photos.length > 0 && (state.currentIndex < 0 || state.currentIndex >= state.photos.length)) {
    state.currentIndex = 0;
  }

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

let isWebpSupportedCache = null;
function checkWebpSupport() {
  if (isWebpSupportedCache !== null) return isWebpSupportedCache;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL("image/webp");
    isWebpSupportedCache = typeof dataUrl === "string" && dataUrl.startsWith("data:image/webp");
  } catch {
    isWebpSupportedCache = false;
  }
  return isWebpSupportedCache;
}

function optimizedFileName(fileName, suffix = "", extension = "webp") {
  const name = fileName || "memory-photo";
  const base = name.replace(/\.[^.]+$/, "") || "memory-photo";
  return `${base}${suffix}.${extension}`;
}

async function createOptimizedImageDerivative(file, {
  maxEdge,
  quality,
  suffix = "",
  dimensions: knownDimensions = null,
  forceFormat = null,
}) {
  const originalDimensions = knownDimensions || await getImageDimensions(file);
  if (!originalDimensions.width || !originalDimensions.height) return null;

  const scale = Math.min(1, maxEdge / Math.max(originalDimensions.width, originalDimensions.height));
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

  const preferWebp = forceFormat ? forceFormat === "image/webp" : checkWebpSupport();
  const mimeType = preferWebp ? "image/webp" : "image/jpeg";

  let blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });

  // フォールバック
  if (!blob && preferWebp) {
    blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
  }

  if (!blob) return null;

  const finalType = blob.type || mimeType;
  const ext = finalType.includes("webp") ? "webp" : "jpg";

  return {
    file: new File([blob], optimizedFileName(file.name, suffix, ext), {
      type: finalType,
      lastModified: file.lastModified || Date.now(),
    }),
    dimensions: { width, height },
  };
}

const createJpegDerivative = createOptimizedImageDerivative;

async function optimizeImageForApi(file) {
  const originalDimensions = await getImageDimensions(file);
  const isWebp = file.type?.toLowerCase() === "image/webp";
  const needsResize = file.size > API_OPTIMIZE_THRESHOLD_BYTES;
  const needsFormatConversion = !isWebp && (!API_WEB_FRIENDLY_IMAGE_TYPES.has(file.type.toLowerCase()) || checkWebpSupport());
  
  if (!originalDimensions.width || !originalDimensions.height || (!needsResize && !needsFormatConversion)) {
    return { file, dimensions: originalDimensions };
  }

  return await createOptimizedImageDerivative(file, {
    maxEdge: needsResize ? API_MAX_IMAGE_EDGE : Math.max(originalDimensions.width, originalDimensions.height),
    quality: API_IMAGE_QUALITY,
    dimensions: originalDimensions,
  }) || { file, dimensions: originalDimensions };
}

async function createThumbnailForApi(file) {
  const thumbnail = await createOptimizedImageDerivative(file, {
    maxEdge: API_THUMBNAIL_MAX_IMAGE_EDGE,
    quality: API_THUMBNAIL_QUALITY,
    suffix: "-thumb",
  });

  if (!thumbnail) return null;

  return thumbnail.file;
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

async function uploadPhotoToCloud(file, dimensions, photoId = generatePhotoId(), metadata = {}) {
  if (cloud.provider === "api") {
    const { file: uploadFile, dimensions: uploadDimensions } = await optimizeImageForApi(file);
    const dataUrl = await blobToDataUrl(uploadFile);
    let thumbnailDataUrl = "";
    try {
      const thumbnailFile = await createThumbnailForApi(uploadFile);
      thumbnailDataUrl = thumbnailFile ? await blobToDataUrl(thumbnailFile) : "";
    } catch (error) {
      console.warn("アップロード用サムネイルの作成に失敗しました。", error);
    }

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
        date: metadata.date || uploadFile.lastModified || file.lastModified || Date.now(),
        width: uploadDimensions.width || dimensions.width,
        height: uploadDimensions.height || dimensions.height,
        dataUrl,
        thumbnailDataUrl,
        location: metadata.location || null,
        exif: metadata.exif || null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      ...hydrateApiPhoto(result.photo),
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
  restoreCachedCloudPhotos({ keepLocal });
  try {
    if (cloud.provider === "api") {
      const response = await fetch(apiUrl("/api/photos"));
      if (!response.ok) throw new Error(`Load failed: ${response.status}`);
      const result = await response.json();
      const cloudPhotos = (result.photos || []).map(hydrateApiPhoto);
      const cloudIds = new Set(cloudPhotos.map((photo) => photo.id));
      const unsyncedLocal = keepLocal
        ? localOnlyPhotos().filter((photo) => !cloudIds.has(photo.id))
        : [];

      const targetId = initialPhotoSelectedId || state.photos[state.currentIndex]?.id;
      revokePhotoUrls();
      state.photos = [...cloudPhotos, ...unsyncedLocal];
      state.activeCollection = "all";
      const existingIdx = targetId ? state.photos.findIndex((photo) => photo.id === targetId) : -1;
      if (existingIdx >= 0) {
        state.currentIndex = existingIdx;
      } else {
        setRandomCurrentIndex();
        initialPhotoSelectedId = state.photos[state.currentIndex]?.id;
      }
      writeCloudPhotoCache(cloudPhotos);
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

    const targetId = initialPhotoSelectedId || state.photos[state.currentIndex]?.id;
    revokePhotoUrls();
    state.photos = [...cloudPhotos, ...unsyncedLocal];
    state.activeCollection = "all";
    const existingIdx = targetId ? state.photos.findIndex((photo) => photo.id === targetId) : -1;
    if (existingIdx >= 0) {
      state.currentIndex = existingIdx;
    } else {
      setRandomCurrentIndex();
      initialPhotoSelectedId = state.photos[state.currentIndex]?.id;
    }
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

  const isTrash = state.activeCollection === "trash";
  const confirmMsg = isTrash
    ? `${photos.length}枚の写真を完全に削除しますか？\nこの操作は取り消せません。`
    : `${photos.length}枚の写真を削除しますか？\n（「最近削除した項目」から30日間復元できます）`;

  if (!window.confirm(confirmMsg)) return;

  pauseMemory();
  cloud.loading = photos.some((photo) => photo.source === "cloud");
  updateSelectionControls();
  updateSyncStatus(isTrash ? `${photos.length}枚を完全削除しています...` : `${photos.length}枚をゴミ箱に移動中...`);

  try {
    if (isTrash) {
      // 物理完全削除
      const photoIds = new Set(photos.map((photo) => photo.id));
      for (const photo of photos) {
        await deleteCloudPhoto(photo);
      }
      await deleteLocalPhotos(photos.filter((photo) => photo.blob).map((photo) => photo.id));
      photos.forEach((photo) => {
        if (photo.url) URL.revokeObjectURL(photo.url);
      });
      state.photos = state.photos.filter((photo) => !photoIds.has(photo.id));
      if (!trashPhotos().length) {
        state.activeCollection = "all";
      }
      updateShareStatus(`${photos.length}枚を完全に削除しました`);
    } else {
      // 30日ゴミ箱（ソフトデリート）
      const now = Date.now();
      for (const photo of photos) {
        photo.deletedAt = now;
        if (cloud.ready && photo.source === "cloud") {
          try {
            await fetch(apiUrl(`/api/photos/${encodeURIComponent(photo.id)}`), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deletedAt: now }),
            });
          } catch (e) {
            console.warn("Cloud soft-delete failed:", e);
          }
        }
        if (photo.source === "local" || photo.blob) {
          try {
            await savePhoto(photo);
          } catch (e) {
            console.warn("Local soft-delete failed:", e);
          }
        }
      }
      updateShareStatus(`${photos.length}枚を「最近削除した項目」に移動しました`);
    }

    state.selectedIds.clear();
    state.selectionMode = false;
    state.currentIndex = Math.min(state.currentIndex, Math.max(0, visiblePhotos().length - 1));
    writeCloudPhotoCache(state.photos);
    render();
  } catch (error) {
    console.warn("写真の削除処理に失敗しました。", error);
    updateShareStatus("写真の削除に失敗しました");
  } finally {
    cloud.loading = false;
    updateSyncStatus();
    updateSelectionControls();
  }
}

async function restoreSelectedPhotos() {
  const photos = selectedPhotos();
  if (!photos.length) return;

  pauseMemory();
  cloud.loading = photos.some((photo) => photo.source === "cloud");
  updateSelectionControls();
  updateSyncStatus(`${photos.length}枚を復元しています...`);

  try {
    for (const photo of photos) {
      photo.deletedAt = null;
      if (cloud.ready && photo.source === "cloud") {
        try {
          await fetch(apiUrl(`/api/photos/${encodeURIComponent(photo.id)}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deletedAt: null }),
          });
        } catch (e) {
          console.warn("Cloud restore failed:", e);
        }
      }
      if (photo.source === "local" || photo.blob) {
        try {
          await savePhoto(photo);
        } catch (e) {
          console.warn("Local restore failed:", e);
        }
      }
    }

    state.selectedIds.clear();
    state.selectionMode = false;
    if (!trashPhotos().length) {
      state.activeCollection = "all";
    }
    writeCloudPhotoCache(state.photos);
    render();
    updateShareStatus(`${photos.length}枚の写真を復元しました`);
  } catch (error) {
    console.warn("写真の復元に失敗しました。", error);
    updateShareStatus("写真の復元に失敗しました");
  } finally {
    cloud.loading = false;
    updateSyncStatus();
    updateSelectionControls();
  }
}

async function convertHeicIfNeeded(file) {
  const isHeic = file.name.match(/\.(heic|heif)$/i) || file.type.includes("heic") || file.type.includes("heif");
  if (isHeic && typeof window.heic2any === "function") {
    try {
      const convertedBlob = await window.heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.85,
      });
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
    } catch (e) {
      console.warn("HEIC conversion failed:", e);
    }
  }
  return file;
}

async function extractExifDate(file) {
  try {
    const buffer = await file.slice(0, 128 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xffd8) return null;

    let offset = 2;
    const length = buffer.byteLength;
    while (offset < length) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xe1) {
        const exifLength = view.getUint16(offset + 2, false);
        const exifBuffer = buffer.slice(offset + 4, offset + 2 + exifLength);
        const str = new TextDecoder("latin1").decode(exifBuffer);
        const match = /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str);
        if (match) {
          const [_, y, m, d, h, min, s] = match;
          const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s));
          if (!isNaN(date.getTime())) return date.getTime();
        }
        break;
      }
      offset += 2 + view.getUint16(offset + 2, false);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function extractExifMetadata(file) {
  const result = {
    date: null,
    camera: null,
    location: null,
    size: file.size || 0,
  };

  if (typeof window.EXIF !== "undefined" && window.EXIF.getData) {
    try {
      await new Promise((resolve) => {
        window.EXIF.getData(file, function () {
          try {
            // 1. 撮影日時
            const dt = window.EXIF.getTag(this, "DateTimeOriginal") || window.EXIF.getTag(this, "DateTime");
            if (dt && typeof dt === "string") {
              const match = /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dt);
              if (match) {
                const [_, y, m, d, h, min, s] = match;
                const dObj = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s));
                if (!isNaN(dObj.getTime())) result.date = dObj.getTime();
              }
            }

            // 2. カメラ機種
            const make = window.EXIF.getTag(this, "Make");
            const model = window.EXIF.getTag(this, "Model");
            if (model) {
              const cleanMake = make ? String(make).trim() : "";
              const cleanModel = String(model).trim();
              result.camera = cleanModel.startsWith(cleanMake) ? cleanModel : `${cleanMake} ${cleanModel}`.trim();
            }

            // 3. GPS 位置情報
            const lat = window.EXIF.getTag(this, "GPSLatitude");
            const latRef = window.EXIF.getTag(this, "GPSLatitudeRef");
            const lng = window.EXIF.getTag(this, "GPSLongitude");
            const lngRef = window.EXIF.getTag(this, "GPSLongitudeRef");

            if (lat && lng && Array.isArray(lat) && Array.isArray(lng)) {
              const dLat = Number(lat[0]) + Number(lat[1]) / 60 + Number(lat[2]) / 3600;
              const dLng = Number(lng[0]) + Number(lng[1]) / 60 + Number(lng[2]) / 3600;
              const finalLat = (latRef === "S" || latRef === "s") ? -dLat : dLat;
              const finalLng = (lngRef === "W" || lngRef === "w") ? -dLng : dLng;
              if (!isNaN(finalLat) && !isNaN(finalLng)) {
                result.location = { lat: finalLat, lng: finalLng };
              }
            }
          } catch (ex) {
            console.warn("EXIF tag parse error:", ex);
          }
          resolve();
        });
      });
    } catch (e) {
      console.warn("EXIF extraction error:", e);
    }
  }

  // フォールバック: 自前バイナリパースで日付抽出
  if (!result.date) {
    result.date = await extractExifDate(file);
  }

  return result;
}

function showUploadProgress(total) {
  if (!els.uploadProgressModal) return;
  els.progressTitle.textContent = "写真を処理中...";
  els.progressSubtitle.textContent = `0 / ${total}枚を処理中`;
  els.progressBarFill.style.width = "0%";
  els.uploadProgressModal.hidden = false;
}

function updateUploadProgress(current, total) {
  if (!els.uploadProgressModal) return;
  const pct = Math.round((current / total) * 100);
  els.progressSubtitle.textContent = `${current} / ${total}枚を処理完了 (${pct}%)`;
  els.progressBarFill.style.width = `${pct}%`;
}

function hideUploadProgress() {
  if (!els.uploadProgressModal) return;
  els.uploadProgressModal.hidden = true;
}

async function importFiles(fileList) {
  const rawFiles = Array.from(fileList);
  if (!rawFiles.length) return;

  pauseMemory();
  showUploadProgress(rawFiles.length);

  const firstImportedId = generatePhotoId();
  for (const [index, rawFile] of rawFiles.entries()) {
    updateUploadProgress(index, rawFiles.length);
    const file = await convertHeicIfNeeded(rawFile);
    if (!isSupportedImageFile(file)) continue;

    const exifMeta = await extractExifMetadata(file);
    const photoDate = exifMeta.date || file.lastModified || Date.now();
    const dimensions = await getImageDimensions(file);
    const photoId = index === 0 ? firstImportedId : generatePhotoId();

    if (cloud.ready) {
      try {
        const uploaded = await uploadPhotoToCloud(file, dimensions, photoId, {
          date: photoDate,
          location: exifMeta.location,
          exif: { camera: exifMeta.camera, size: file.size },
        });
        uploaded.date = photoDate;
        uploaded.location = exifMeta.location;
        uploaded.exif = { camera: exifMeta.camera, size: file.size };
        state.photos.push(uploaded);
        continue;
      } catch (error) {
        console.warn("クラウドへのアップロードに失敗しました。端末内に保存します。", error);
        updateShareStatus("クラウド保存に失敗したため端末内に保存しました");
      }
    }

    let thumbnailBlob = null;
    try {
      thumbnailBlob = await createThumbnailForApi(file);
    } catch (error) {
      console.warn("サムネイルの作成に失敗しました。", error);
    }

    const photo = {
      id: photoId,
      name: file.name,
      type: file.type,
      date: photoDate,
      width: dimensions.width,
      height: dimensions.height,
      blob: file,
      thumbnailBlob,
      source: "local",
      memo: "",
      favorite: false,
      tags: [],
      location: exifMeta.location,
      exif: { camera: exifMeta.camera, size: file.size },
    };
    try {
      await savePhoto(photo);
    } catch (error) {
      console.warn("写真のブラウザ保存に失敗しました。表示はこのセッション内で続けます。", error);
    }
    state.photos.push(photo);
  }

  updateUploadProgress(rawFiles.length, rawFiles.length);
  setTimeout(hideUploadProgress, 300);

  sortPhotos();
  state.currentIndex = Math.max(0, state.photos.findIndex((photo) => photo.id === firstImportedId));
  state.activeCollection = "all";
  writeCloudPhotoCache(state.photos);
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

      let thumbnailBlob = null;
      try {
        thumbnailBlob = await createThumbnailForApi(blob);
      } catch (error) {
        console.warn("読み込んだ写真のサムネイル作成に失敗しました。", error);
      }

      const photo = {
        id,
        name: item.name || "memory-photo",
        type: item.type || blob.type,
        date: Number(item.date) || Date.now(),
        width: Number(item.width) || 0,
        height: Number(item.height) || 0,
        blob,
        thumbnailBlob,
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
    writeCloudPhotoCache(state.photos);
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
  if (!initialPhotoSelectedId && state.photos.length > 0) {
    setRandomCurrentIndex();
    initialPhotoSelectedId = state.photos[state.currentIndex]?.id;
  }
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
    view: state.view,
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
  } else {
    els.speedRange.value = "5";
    state.speed = 5000;
    els.speedValue.textContent = "5秒";
  }
  if (preferences.themeDark) document.body.classList.add("theme-dark");
  applyMood(preferences.mood || "cinema");

  const viewMode = preferences.view === "strip" ? "strip" : "grid";
  state.view = viewMode;
  document.querySelectorAll("[data-view]").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewMode);
  });
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
    savePreferences();
  });
});

els.themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("theme-dark");
  savePreferences();
});

// === 新機能ロジック ===

// 1. お気に入りトグル
async function toggleFavoriteCurrentPhoto() {
  const current = state.photos[state.currentIndex];
  if (!current) return;
  current.favorite = !current.favorite;
  if (els.favoriteBtn) {
    els.favoriteBtn.classList.toggle("is-favorite", current.favorite);
  }

  if (current.source === "local" || current.blob) {
    try {
      await savePhoto(current);
    } catch (e) {
      console.warn("Favorite save local failed:", e);
    }
  }

  if (cloud.ready && current.source === "cloud") {
    try {
      await fetch(apiUrl(`/api/photos/${encodeURIComponent(current.id)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: current.favorite }),
      });
    } catch (e) {
      console.warn("Favorite save cloud failed:", e);
    }
  }

  writeCloudPhotoCache(state.photos);
  renderCollections();
  renderThumbs();
}

// 2. 写真メモ保存
async function saveCurrentPhotoMemo(newMemo) {
  const current = state.photos[state.currentIndex];
  if (!current) return;
  current.memo = newMemo.trim();
  if (els.photoMemoText) {
    els.photoMemoText.textContent = current.memo ? `💬 ${current.memo}` : "💬 メモを追加...";
    els.photoMemoText.hidden = false;
  }
  if (els.photoMemoEditBox) {
    els.photoMemoEditBox.hidden = true;
  }

  if (current.source === "local" || current.blob) {
    try {
      await savePhoto(current);
    } catch (e) {
      console.warn("Memo save local failed:", e);
    }
  }

  if (cloud.ready && current.source === "cloud") {
    try {
      await fetch(apiUrl(`/api/photos/${encodeURIComponent(current.id)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: current.memo }),
      });
    } catch (e) {
      console.warn("Memo save cloud failed:", e);
    }
  }

  writeCloudPhotoCache(state.photos);
}

// 3. 一括ZIPダウンロード
async function exportAlbumAsZip() {
  if (typeof window.JSZip !== "function") {
    updateShareStatus("ZIPライブラリの読み込みに失敗しました");
    return;
  }

  const photos = visiblePhotos();
  if (!photos.length) return;

  const zip = new window.JSZip();
  const folderName = safeFileName(els.albumName.value.trim() || DEFAULT_ALBUM_NAME);
  const folder = zip.folder(folderName);

  showUploadProgress(photos.length);
  els.progressTitle.textContent = "ZIPファイルを作成中...";

  try {
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      updateUploadProgress(i + 1, photos.length);
      let blob = null;
      if (photo.blob) {
        blob = photo.blob;
      } else {
        const response = await fetch(createPhotoUrl(photo));
        blob = await response.blob();
      }

      const ext = photo.type?.includes("webp") ? "webp" : (photo.type === "image/png" ? "png" : "jpg");
      const fileName = `${String(i + 1).padStart(3, "0")}_${formatDate(photo.date).replace(/[年月日]/g, "-")}_${photo.name || "photo"}.${ext}`;
      folder.file(fileName, blob);
    }

    els.progressSubtitle.textContent = "ZIP圧縮中...";
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${folderName}_photos_${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    updateShareStatus("写真の一括ZIP保存が完了しました");
  } catch (error) {
    console.error("ZIP export failed:", error);
    updateShareStatus("ZIP作成に失敗しました");
  } finally {
    hideUploadProgress();
  }
}

// 4. BGMプレイヤー & トースト通知
let bgmToastTimer = null;
function showBgmToast(text) {
  if (!els.bgmToast || !els.bgmToastText) return;
  els.bgmToastText.textContent = text;
  els.bgmToast.hidden = false;
  if (bgmToastTimer) clearTimeout(bgmToastTimer);
  bgmToastTimer = setTimeout(() => {
    els.bgmToast.hidden = true;
  }, 3200);
}

const BGM_GENRES = [
  {
    id: "musicbox",
    name: "オルゴール調",
    oscType: "sine",
    tempo: 440,
    duration: 1.4,
    gain: 0.12,
    scale: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51],
    pattern: [0, 2, 4, 3, 2, 4, 6, 5, 4, 2, 0, 1, 2, 4, 3, 0],
  },
  {
    id: "cafepiano",
    name: "カフェピアノ風",
    oscType: "triangle",
    tempo: 520,
    duration: 1.6,
    gain: 0.14,
    scale: [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99],
    pattern: [0, 3, 2, 4, 1, 3, 5, 4, 2, 4, 3, 1, 0, 2, 4, 2],
  },
  {
    id: "acoustic",
    name: "アコースティック風",
    oscType: "sine",
    tempo: 380,
    duration: 1.1,
    gain: 0.13,
    scale: [329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0],
    pattern: [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 3, 1, 2, 0, 1, 0],
  },
  {
    id: "ambient",
    name: "星空アンビエント",
    oscType: "sine",
    tempo: 850,
    duration: 3.2,
    gain: 0.10,
    scale: [261.63, 329.63, 392.0, 493.88, 587.33, 659.25],
    pattern: [0, 2, 3, 4, 2, 1, 3, 5],
  },
];

const bgmPlayer = {
  ctx: null,
  isPlaying: false,
  timer: null,
  currentGenre: null,
  init() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
  },
  playNote(freq, time, duration, gainLevel = 0.12, type = "sine") {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    const attack = type === "sine" && duration > 2 ? 0.35 : 0.04;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(gainLevel, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + duration);
  },
  toggle() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    this.isPlaying = !this.isPlaying;
    const offIcon = els.bgmToggle?.querySelector(".bgm-off-icon");
    const onIcon = els.bgmToggle?.querySelector(".bgm-on-icon");
    if (offIcon) offIcon.hidden = this.isPlaying;
    if (onIcon) onIcon.hidden = !this.isPlaying;
    els.bgmToggle?.classList.toggle("active", this.isPlaying);

    if (this.isPlaying) {
      // ランダムにジャンルを選択
      const genre = BGM_GENRES[Math.floor(Math.random() * BGM_GENRES.length)];
      this.currentGenre = genre;
      showBgmToast(`🎵 ${genre.name}を再生中`);
      this.startMelody();
    } else {
      this.stopMelody();
    }
  },
  startMelody() {
    const genre = this.currentGenre || BGM_GENRES[0];
    const { scale, pattern, tempo, duration, gain, oscType } = genre;
    let step = 0;

    this.timer = setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      const note = scale[pattern[step % pattern.length]];
      this.playNote(note, this.ctx.currentTime, duration, gain, oscType);

      // 低音ベース音（4拍ごと）
      if (step % 4 === 0) {
        this.playNote(scale[0] / 2, this.ctx.currentTime, duration * 1.3, gain * 0.9, "sine");
      }
      step++;
    }, tempo);
  },
  stopMelody() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
};

// 6. 🗺️ ふたりのデートマップ
let mapInstance = null;
let mapMarkersGroup = null;

function escapeHtmlText(str) {
  return String(str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function openDateMap() {
  if (!els.mapModal) return;
  pauseMemory();
  els.mapModal.hidden = false;

  const geoPhotos = activePhotos().filter((p) => p.location && Number.isFinite(p.location.lat) && Number.isFinite(p.location.lng));
  if (els.mapPinCount) {
    els.mapPinCount.textContent = `${geoPhotos.length}箇所の思い出`;
  }

  if (!mapInstance && typeof window.L !== "undefined") {
    mapInstance = L.map("mapContainer").setView([35.6812, 139.7671], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(mapInstance);
    mapMarkersGroup = L.featureGroup().addTo(mapInstance);
  }

  setTimeout(() => {
    if (mapInstance) {
      mapInstance.invalidateSize();
      renderMapMarkers(geoPhotos);
    }
  }, 120);
}

function closeDateMap() {
  if (els.mapModal) els.mapModal.hidden = true;
}

function renderMapMarkers(geoPhotos) {
  if (!mapMarkersGroup || !mapInstance) return;
  mapMarkersGroup.clearLayers();

  if (!geoPhotos.length) return;

  geoPhotos.forEach((photo) => {
    const lat = photo.location.lat;
    const lng = photo.location.lng;
    const thumbUrl = createThumbnailUrl(photo) || createPhotoUrl(photo);
    const dateStr = formatDate(photo.date);
    const memoStr = photo.memo ? photo.memo : "思い出の写真";

    const popupContent = document.createElement("div");
    popupContent.className = "map-popup-card";
    popupContent.innerHTML = `
      <img src="${thumbUrl}" alt="">
      <div class="map-popup-info">
        <div class="map-popup-date">📅 ${dateStr}</div>
        <div class="map-popup-memo">${escapeHtmlText(memoStr)}</div>
        <div class="map-popup-action">▶ 写真を表示</div>
      </div>
    `;
    popupContent.addEventListener("click", () => {
      jumpToPhotoFromMap(photo.id);
    });

    const marker = L.marker([lat, lng]).bindPopup(popupContent, { maxWidth: 240 });
    mapMarkersGroup.addLayer(marker);
  });

  const bounds = mapMarkersGroup.getBounds();
  if (bounds.isValid()) {
    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }
}

function jumpToPhotoFromMap(photoId) {
  const index = state.photos.findIndex((p) => p.id === photoId);
  if (index >= 0) {
    state.activeCollection = "all";
    state.currentIndex = index;
    closeDateMap();
    render();
  }
}

// 7. ℹ️ 写真の詳細情報シート
function openPhotoInfo() {
  const current = state.photos[state.currentIndex];
  if (!current || !els.infoModal) return;

  const d = new Date(current.date);
  const days = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  const dayStr = days[d.getDay()];

  if (els.infoDate) {
    els.infoDate.textContent = `${formatDate(current.date)} ${d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (els.infoDayOfWeek) {
    els.infoDayOfWeek.textContent = dayStr;
  }
  if (els.infoCamera) {
    els.infoCamera.textContent = current.exif?.camera || "スマートフォン / デジタルカメラ";
  }
  if (els.infoDimensions) {
    if (current.width && current.height) {
      const mp = ((current.width * current.height) / 1000000).toFixed(1);
      els.infoDimensions.textContent = `${current.width} × ${current.height} px (${mp}MP)`;
    } else {
      els.infoDimensions.textContent = "標準解像度";
    }
  }
  if (els.infoSize) {
    if (current.exif?.size) {
      const mb = (current.exif.size / (1024 * 1024)).toFixed(2);
      els.infoSize.textContent = `${mb} MB (${current.name || "写真"})`;
    } else {
      els.infoSize.textContent = current.name || "写真ファイル";
    }
  }
  if (els.infoLocationText && els.infoShowOnMapBtn) {
    if (current.location && Number.isFinite(current.location.lat) && Number.isFinite(current.location.lng)) {
      const lat = current.location.lat.toFixed(4);
      const lng = current.location.lng.toFixed(4);
      els.infoLocationText.textContent = `緯度: ${lat}, 経度: ${lng}`;
      els.infoShowOnMapBtn.hidden = false;
      els.infoShowOnMapBtn.onclick = () => {
        closePhotoInfo();
        openDateMap();
      };
    } else {
      els.infoLocationText.textContent = "位置情報なし";
      els.infoShowOnMapBtn.hidden = true;
    }
  }

  els.infoModal.hidden = false;
}

function closePhotoInfo() {
  if (els.infoModal) els.infoModal.hidden = true;
}

// 8. スワイプ操作
function initSwipeControls() {
  let touchStartX = 0;
  let touchStartY = 0;

  els.memoryStage?.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  els.memoryStage?.addEventListener("touchend", (e) => {
    const diffX = e.changedTouches[0].screenX - touchStartX;
    const diffY = e.changedTouches[0].screenY - touchStartY;

    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      pauseMemory();
      if (diffX < 0) {
        nextPhoto();
      } else {
        previousPhoto();
      }
    }
  }, { passive: true });
}

// 6. 全画面シアターモード & Lightbox
function toggleTheaterMode() {
  document.body.classList.toggle("theater-mode");
  if (document.body.classList.contains("theater-mode")) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

function openLightbox() {
  const current = state.photos[state.currentIndex];
  if (!current || !els.lightboxModal) return;
  els.lightboxImg.src = createPhotoUrl(current);
  els.lightboxModal.hidden = false;
}

function closeLightbox() {
  if (els.lightboxModal) els.lightboxModal.hidden = true;
}

// 7. PWA初期化
function initPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  }
}

els.exportBtn.addEventListener("click", exportAlbum);
els.zipExportBtn?.addEventListener("click", exportAlbumAsZip);

els.bgmToggle?.addEventListener("click", () => bgmPlayer.toggle());
els.fullscreenToggle?.addEventListener("click", toggleTheaterMode);

els.favoriteBtn?.addEventListener("click", toggleFavoriteCurrentPhoto);
els.zoomBtn?.addEventListener("click", openLightbox);
els.lightboxCloseBtn?.addEventListener("click", closeLightbox);
els.lightboxModal?.addEventListener("click", (e) => {
  if (e.target === els.lightboxModal || e.target.classList.contains("lightbox-content")) {
    closeLightbox();
  }
});

els.photoMemoText?.addEventListener("click", () => {
  const current = state.photos[state.currentIndex];
  if (els.photoMemoInput) {
    els.photoMemoInput.value = current?.memo || "";
  }
  if (els.photoMemoText) els.photoMemoText.hidden = true;
  if (els.photoMemoEditBox) els.photoMemoEditBox.hidden = false;
  els.photoMemoInput?.focus();
});

els.photoMemoSaveBtn?.addEventListener("click", () => {
  if (els.photoMemoInput) {
    saveCurrentPhotoMemo(els.photoMemoInput.value);
  }
});

els.photoMemoCancelBtn?.addEventListener("click", () => {
  if (els.photoMemoEditBox) els.photoMemoEditBox.hidden = true;
  if (els.photoMemoText) els.photoMemoText.hidden = false;
  const current = state.photos[state.currentIndex];
  if (els.photoMemoInput) {
    els.photoMemoInput.value = current?.memo || "";
  }
});

els.photoMemoInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    saveCurrentPhotoMemo(els.photoMemoInput.value);
  } else if (e.key === "Escape") {
    if (els.photoMemoEditBox) els.photoMemoEditBox.hidden = true;
    if (els.photoMemoText) els.photoMemoText.hidden = false;
  }
});

els.playOnThisDayBtn?.addEventListener("click", () => {
  state.activeCollection = "on_this_day";
  const onThisDay = getOnThisDayPhotos();
  if (onThisDay.length) {
    state.currentIndex = state.photos.findIndex((p) => p.id === onThisDay[0].id);
    render();
    playMemory();
  }
});

// === 🔒 プライベートロック (Face ID / 生体認証 WebAuthn & PIN) ===
const LOCK_CONFIG_KEY = "date-memory-lock-config";
const LAST_UNLOCKED_KEY = "date-memory-last-unlocked";

let lockConfig = {
  enabled: false,
  pinHash: "",
  bioEnabled: false,
  credentialId: "",
  gracePeriod: 900000, // 15分
};

let currentEnteredPin = "";

function loadLockConfig() {
  try {
    const raw = localStorage.getItem(LOCK_CONFIG_KEY);
    if (raw) {
      lockConfig = { ...lockConfig, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn("Lock config load failed:", e);
  }
}

function saveLockConfig() {
  try {
    localStorage.setItem(LOCK_CONFIG_KEY, JSON.stringify(lockConfig));
    updateLockUI();
  } catch (e) {
    console.warn("Lock config save failed:", e);
  }
}

async function hashPin(pin) {
  const enc = new TextEncoder().encode(pin + "_date_memory_salt_2026");
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function isBiometricsSupported() {
  return Boolean(window.PublicKeyCredential && navigator.credentials);
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function registerBiometrics() {
  if (!isBiometricsSupported()) {
    alert("この端末・ブラウザは生体認証（Face ID / Touch ID）に対応していません。");
    return false;
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "デートのメモリー", id: window.location.hostname },
        user: {
          id: userId,
          name: "date-memory-user",
          displayName: "デートのメモリー",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      }
    });

    if (cred) {
      lockConfig.bioEnabled = true;
      lockConfig.credentialId = bufferToBase64(cred.rawId);
      saveLockConfig();
      alert("✅ Face ID / 生体認証を登録しました！次回から画面を見るだけで解除できます。");
      return true;
    }
  } catch (err) {
    console.warn("Biometrics registration cancelled or failed:", err);
    if (err.name !== "NotAllowedError") {
      alert("生体認証の登録に失敗しました: " + (err.message || err.name));
    }
  }
  return false;
}

async function authenticateBiometrics() {
  if (!lockConfig.bioEnabled || !isBiometricsSupported()) {
    showPinEntry();
    return false;
  }

  showLockError("");
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const getOptions = {
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: "required",
        timeout: 60000,
      }
    };

    if (lockConfig.credentialId) {
      getOptions.publicKey.allowCredentials = [{
        id: base64ToBuffer(lockConfig.credentialId),
        type: "public-key",
        transports: ["internal"],
      }];
    }

    const assertion = await navigator.credentials.get(getOptions);
    if (assertion) {
      unlockApp();
      return true;
    }
  } catch (err) {
    console.warn("Biometrics authentication failed/cancelled:", err);
    showLockError("Face ID がキャンセルされました。パスコードで解除してください。");
    showPinEntry();
  }
  return false;
}

function updateLockUI() {
  if (els.lockStatusBadge) {
    els.lockStatusBadge.textContent = lockConfig.enabled ? "ON" : "OFF";
    els.lockStatusBadge.style.color = lockConfig.enabled ? "var(--accent)" : "var(--muted)";
  }
  if (els.lockNowBtn) {
    els.lockNowBtn.hidden = !lockConfig.enabled;
  }
  if (els.lockEnabledToggle) {
    els.lockEnabledToggle.checked = lockConfig.enabled;
  }
  if (els.lockOptionsArea) {
    els.lockOptionsArea.hidden = !lockConfig.enabled;
  }
  if (els.bioStatusDesc) {
    els.bioStatusDesc.textContent = lockConfig.bioEnabled ? "✅ Face ID / 生体認証 設定済み" : "登録すると画面を見るだけでロック解除";
  }
  if (els.registerBioBtn) {
    els.registerBioBtn.textContent = lockConfig.bioEnabled ? "Face ID を再登録" : "Face ID を登録";
  }
  if (els.lockGracePeriodSelect) {
    els.lockGracePeriodSelect.value = String(lockConfig.gracePeriod ?? 900000);
  }
}

function showLockScreen() {
  if (!lockConfig.enabled || (!lockConfig.pinHash && !lockConfig.bioEnabled)) return;
  
  if (els.lockScreenModal) {
    els.lockScreenModal.hidden = false;
    currentEnteredPin = "";
    updatePinDots();
    showLockError("");

    if (lockConfig.bioEnabled) {
      els.lockBioBtn.hidden = false;
      els.pinEntryContainer.hidden = true;
      els.togglePinInputBtn.textContent = "4桁パスコードで解除";
      els.togglePinInputBtn.hidden = false;
      // 開いた瞬間に Face ID を自動起動
      setTimeout(() => {
        authenticateBiometrics();
      }, 300);
    } else {
      showPinEntry();
      els.togglePinInputBtn.hidden = true;
    }
  }
}

function showPinEntry() {
  if (els.lockBioBtn) els.lockBioBtn.hidden = true;
  if (els.pinEntryContainer) els.pinEntryContainer.hidden = false;
  if (els.togglePinInputBtn) {
    els.togglePinInputBtn.textContent = lockConfig.bioEnabled ? "Face ID で解除に戻る" : "";
    els.togglePinInputBtn.hidden = !lockConfig.bioEnabled;
  }
  currentEnteredPin = "";
  updatePinDots();
}

function unlockApp() {
  if (els.lockScreenModal) {
    els.lockScreenModal.hidden = true;
  }
  sessionStorage.setItem(LAST_UNLOCKED_KEY, String(Date.now()));
  localStorage.setItem(LAST_UNLOCKED_KEY, String(Date.now()));
}

function lockAppNow() {
  sessionStorage.removeItem(LAST_UNLOCKED_KEY);
  localStorage.removeItem(LAST_UNLOCKED_KEY);
  showLockScreen();
}

function checkAppLockOnResume() {
  if (!lockConfig.enabled) return;
  if (!lockConfig.pinHash && !lockConfig.bioEnabled) return;
  const lastTime = Number(sessionStorage.getItem(LAST_UNLOCKED_KEY) || localStorage.getItem(LAST_UNLOCKED_KEY) || 0);
  const now = Date.now();
  const grace = lockConfig.gracePeriod ?? 900000;

  if (!lastTime || (now - lastTime > grace)) {
    showLockScreen();
  }
}

function updatePinDots() {
  if (!els.pinDots) return;
  const dots = els.pinDots.querySelectorAll(".pin-dot");
  dots.forEach((dot, idx) => {
    dot.classList.toggle("filled", idx < currentEnteredPin.length);
  });
}

function showLockError(msg) {
  if (els.lockErrorMsg) {
    els.lockErrorMsg.textContent = msg;
    els.lockErrorMsg.hidden = !msg;
  }
}

async function handlePinInput(digit) {
  if (currentEnteredPin.length >= 4) return;
  currentEnteredPin += digit;
  updatePinDots();
  showLockError("");

  if (currentEnteredPin.length === 4) {
    const hashed = await hashPin(currentEnteredPin);
    if (hashed === lockConfig.pinHash) {
      unlockApp();
    } else {
      showLockError("パスコードが違います");
      if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
      setTimeout(() => {
        currentEnteredPin = "";
        updatePinDots();
      }, 400);
    }
  }
}

// ロック設定モーダル
function openLockConfigModal() {
  if (!els.lockConfigModal) return;
  loadLockConfig();
  updateLockUI();
  if (els.pinSetupForm) els.pinSetupForm.hidden = true;
  els.lockConfigModal.hidden = false;
}

function closeLockConfigModal() {
  if (!els.lockConfigModal) return;
  els.lockConfigModal.hidden = true;
}

// PIN設定開始
function startPinSetup() {
  if (!els.pinSetupForm) return;
  els.pinSetupForm.hidden = false;
  if (els.newPinInput) {
    els.newPinInput.value = "";
    els.newPinInput.focus();
  }
}

async function savePinSetup() {
  const pin = els.newPinInput?.value.trim();
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    alert("4桁の半角数字を入力してください。");
    return;
  }

  lockConfig.pinHash = await hashPin(pin);
  lockConfig.enabled = true;
  saveLockConfig();
  els.pinSetupForm.hidden = true;
  alert("✅ 4桁PINを設定し、プライベートロックを有効にしました！");
}

// ロック関連イベントリスナー登録
els.lockConfigBtn?.addEventListener("click", openLockConfigModal);
els.closeLockConfigBtn?.addEventListener("click", closeLockConfigModal);
els.lockNowBtn?.addEventListener("click", lockAppNow);
els.lockBioBtn?.addEventListener("click", () => authenticateBiometrics());
els.pinBioSwitchBtn?.addEventListener("click", () => authenticateBiometrics());

els.togglePinInputBtn?.addEventListener("click", () => {
  if (els.pinEntryContainer.hidden) {
    showPinEntry();
  } else {
    els.lockBioBtn.hidden = false;
    els.pinEntryContainer.hidden = true;
    els.togglePinInputBtn.textContent = "4桁パスコードで解除";
    authenticateBiometrics();
  }
});

els.pinKeypad?.querySelectorAll(".pin-key[data-key]").forEach((btn) => {
  btn.addEventListener("click", () => handlePinInput(btn.dataset.key));
});

els.pinDeleteBtn?.addEventListener("click", () => {
  if (currentEnteredPin.length > 0) {
    currentEnteredPin = currentEnteredPin.slice(0, -1);
    updatePinDots();
    showLockError("");
  }
});

els.lockEnabledToggle?.addEventListener("change", (e) => {
  if (e.target.checked) {
    if (!lockConfig.pinHash && !lockConfig.bioEnabled) {
      startPinSetup();
    } else {
      lockConfig.enabled = true;
      saveLockConfig();
    }
  } else {
    lockConfig.enabled = false;
    saveLockConfig();
  }
});

els.registerBioBtn?.addEventListener("click", async () => {
  const ok = await registerBiometrics();
  if (ok && !lockConfig.pinHash) {
    startPinSetup();
  }
});

els.changePinBtn?.addEventListener("click", startPinSetup);
els.savePinSetupBtn?.addEventListener("click", savePinSetup);
els.cancelPinSetupBtn?.addEventListener("click", () => {
  if (els.pinSetupForm) els.pinSetupForm.hidden = true;
});

els.lockGracePeriodSelect?.addEventListener("change", (e) => {
  lockConfig.gracePeriod = Number(e.target.value);
  saveLockConfig();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    checkAppLockOnResume();
  }
});

els.syncNowBtn?.addEventListener("click", syncLocalPhotosToCloud);

els.selectModeBtn.addEventListener("click", () => {
  state.selectionMode = !state.selectionMode;
  if (!state.selectionMode) state.selectedIds.clear();
  pauseMemory();
  render();
});

els.deleteSelectedBtn.addEventListener("click", deleteSelectedPhotos);
els.restoreSelectedBtn?.addEventListener("click", restoreSelectedPhotos);

els.mapOpenBtn?.addEventListener("click", openDateMap);
els.mapOpenSideBtn?.addEventListener("click", openDateMap);
els.mapCloseBtn?.addEventListener("click", closeDateMap);
els.mapModal?.addEventListener("click", (e) => {
  if (e.target === els.mapModal) closeDateMap();
});

els.infoBtn?.addEventListener("click", openPhotoInfo);
els.infoCloseBtn?.addEventListener("click", closePhotoInfo);
els.infoModal?.addEventListener("click", (e) => {
  if (e.target === els.infoModal) closePhotoInfo();
});

els.albumImportInput.addEventListener("change", (event) => {
  importAlbumFile(event.target.files[0]);
  event.target.value = "";
});

window.addEventListener("beforeunload", () => {
  revokePhotoUrls();
  savePreferences();
});

initSwipeControls();
initPwa();

applyPreferences();
loadLockConfig();
updateLockUI();
checkAppLockOnResume();
loadInitialPhotos();
