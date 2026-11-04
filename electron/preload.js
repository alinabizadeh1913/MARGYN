const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  platform: process.platform,

  loadDb: () => ipcRenderer.invoke("db-load"),
  saveDb: (data) => ipcRenderer.invoke("db-save", data),
  loadWasm: () => ipcRenderer.invoke("db-load-wasm"),

  loadActivePdf: () => ipcRenderer.invoke("pdf-load-active"),
  saveActivePdf: (data) => ipcRenderer.invoke("pdf-save-active", data),
  clearActivePdf: () => ipcRenderer.invoke("pdf-clear-active"),
  openPdf: () => ipcRenderer.invoke("dialog:openPdf"),

  readPdfPath: (path) => ipcRenderer.invoke("pdf:read-path", path),

  // ✅ API جدید برای گرفتن مسیر فایل درگ شده
  getPathForFile: (file) => webUtils.getPathForFile(file),

  onOpenPdfFile: (callback) => {
    const listener = (event, filePath) => callback(filePath);
    ipcRenderer.on("open-pdf-file", listener);
    return () => ipcRenderer.removeListener("open-pdf-file", listener);
  },

  loadLibraryFile: (path) => ipcRenderer.invoke("library-load-file", path),
  deleteLibraryFile: (path) => ipcRenderer.invoke("library-delete-file", path),
  clearLibraryFolder: () => ipcRenderer.invoke("library-clear-all"),

  selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),
  exportProject: (data, defaultDir) =>
    ipcRenderer.invoke("project:export", { data, defaultDir }),
  saveProject: (data, filePath) =>
    ipcRenderer.invoke("project:save", { data, filePath }),
  importProject: () => ipcRenderer.invoke("project:import"),
  readProjectFromPath: (filePath) =>
    ipcRenderer.invoke("project:read-from-path", filePath),

  onAppCloseRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app-close-request", listener);
    return () => ipcRenderer.removeListener("app-close-request", listener);
  },
  forceCloseApp: () => ipcRenderer.send("app-force-close"),

  onOpenMargynFile: (callback) => {
    const listener = (event, filePath) => callback(filePath);
    ipcRenderer.on("open-margyn-file", listener);
    return () => ipcRenderer.removeListener("open-margyn-file", listener);
  },

  setRecordingShortcut: (isRecording) =>
    ipcRenderer.send("set-recording-shortcut", isRecording),
  onShortcutTriggered: (callback) => {
    const listener = (event, shortcut) => callback(shortcut);
    ipcRenderer.on("shortcut-triggered", listener);
    return () => ipcRenderer.removeListener("shortcut-triggered", listener);
  },
});
