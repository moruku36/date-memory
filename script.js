const DB_NAME = "couple-memory-album";
const DB_VERSION = 1;
const STORE_NAME = "photos";
const PREFERENCES_KEY = "couple-memory-preferences";
const DEFAULT_ALBUM_NAME = "デートのメモリー";

const state = {
  photos: [],
  currentIndex: 0,
  activeCollection: "all",
  isPlaying: false,
  timer: null,
  speed: 4000,
  view: "mosaic",
  mood: "cinema",
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
  albumImportInput: document.getElementById("albumImportInput"),
  exportBtn: document.getElementById("exportBtn"),
  shareStatus: document.getElementById("shareStatus"),
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

function generatePhotoId() {
  const unique = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${Date.now()}-${unique}`;
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

    if (state.view === "mosaic") {
      if (index % 9 === 0) button.classList.add("wide");
      if (index % 7 === 3) button.classList.add("tall");
    }

    if (globalIndex === state.currentIndex) {
      button.classList.add("active");
    }

    const img = document.createElement("img");
    img.src = createPhotoUrl(photo);
    img.alt = photo.name;

    const meta = document.createElement("span");
    meta.className = "thumb-meta";
    meta.innerHTML = `<span>${index + 1}</span><span>${formatDate(photo.date).replace("年", ".").replace("月", ".").replace("日", "")}</span>`;

    button.append(img, meta);
    button.addEventListener("click", () => {
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
  if (current) {
    const nextIndex = state.photos.findIndex((photo) => photo.id === current.id);
    if (nextIndex >= 0) state.currentIndex = nextIndex;
  }
  if (state.currentIndex >= state.photos.length) state.currentIndex = 0;

  renderHero();
  renderCollections();
  renderThumbs();
  els.playBtn.classList.toggle("is-playing", state.isPlaying);
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

async function importFiles(fileList) {
  const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;

  pauseMemory();
  const firstImportedId = generatePhotoId();
  for (const [index, file] of files.entries()) {
    const dimensions = await getImageDimensions(file);
    const photo = {
      id: index === 0 ? firstImportedId : generatePhotoId(),
      name: file.name,
      type: file.type,
      date: file.lastModified || Date.now(),
      width: dimensions.width,
      height: dimensions.height,
      blob: file,
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

async function exportAlbum() {
  if (!state.photos.length) return;

  const photos = await Promise.all(state.photos.map(async (photo) => ({
    id: photo.id,
    name: photo.name,
    type: photo.type || photo.blob.type,
    date: photo.date,
    width: photo.width,
    height: photo.height,
    dataUrl: await blobToDataUrl(photo.blob),
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
      const photo = {
        id,
        name: item.name || "memory-photo",
        type: item.type || blob.type,
        date: Number(item.date) || Date.now(),
        width: Number(item.width) || 0,
        height: Number(item.height) || 0,
        blob,
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
    state.photos = await readAllPhotos();
  } catch (error) {
    console.warn("保存済み写真の読み込みに失敗しました。", error);
    state.photos = [];
  }
  sortPhotos();
  render();
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

els.albumImportInput.addEventListener("change", (event) => {
  importAlbumFile(event.target.files[0]);
  event.target.value = "";
});

els.clearBtn.addEventListener("click", () => {
  if (typeof els.confirmDialog.showModal === "function") {
    els.confirmDialog.showModal();
  }
});

els.confirmClear.addEventListener("click", async () => {
  pauseMemory();
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
});

window.addEventListener("beforeunload", () => {
  revokePhotoUrls();
  savePreferences();
});

applyPreferences();
loadInitialPhotos();
