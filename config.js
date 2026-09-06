const DATE_MEMORY_HOST = window.location.hostname;
const DATE_MEMORY_IS_GITHUB_PAGES = DATE_MEMORY_HOST.endsWith(".github.io");
const DATE_MEMORY_IS_CLOUD = DATE_MEMORY_HOST.endsWith(".vercel.app");

window.DATE_MEMORY_CLOUD = {
  enabled: DATE_MEMORY_IS_GITHUB_PAGES || DATE_MEMORY_IS_CLOUD,
  provider: "api",
  apiBaseUrl: "",
  albumId: "dm_sec_0854100c75fac68b66bd4e30da217bc8",
  adminToken: "",
};
