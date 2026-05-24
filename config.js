const DATE_MEMORY_HOST = window.location.hostname;
const DATE_MEMORY_IS_GITHUB_PAGES = DATE_MEMORY_HOST === "moruku36.github.io";
const DATE_MEMORY_IS_VERCEL = DATE_MEMORY_HOST === "date-memory.vercel.app"
  || DATE_MEMORY_HOST.endsWith(".vercel.app");

window.DATE_MEMORY_CLOUD = {
  enabled: DATE_MEMORY_IS_GITHUB_PAGES || DATE_MEMORY_IS_VERCEL,
  provider: "api",
  apiBaseUrl: DATE_MEMORY_IS_GITHUB_PAGES ? "https://date-memory.vercel.app" : "",
  albumId: "date-memory-main",
  adminToken: "",
};
