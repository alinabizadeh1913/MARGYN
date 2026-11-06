const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Window Controls
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  platform: process.platform,

  // Database (WASM SQLite)
  loadDb: () => ipcRenderer.invoke("db-load"),
  saveDb: (data) => ipcRenderer.invoke("db-save", data),
  loadWasm: () => ipcRenderer.invoke("db-load-wasm"),

  // Crypto / Security
  getCryptoKey: () => ipcRenderer.invoke("crypto-get-key"),

  // Active PDF Management
  loadActivePdf: () => ipcRenderer.invoke("pdf-load-active"),
  saveActivePdf: (data) => ipcRenderer.invoke("pdf-save-active"),
  clearActivePdf: () => ipcRenderer.invoke("pdf-clear-active"),
  openPdf: () => ipcRenderer.invoke("dialog:openPdf"),
  readPdfPath: (path) => ipcRenderer.invoke("pdf:read-path", path),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Library Management
  loadLibraryFile: (path) => ipcRenderer.invoke("library-load-file", path),
  deleteLibraryFile: (path) => ipcRenderer.invoke("library-delete-file", path),
  clearLibraryFolder: () => ipcRenderer.invoke("library-clear-all"),
  saveLibraryFile: (data, name) =>
    ipcRenderer.invoke("library-save-file", { data, name }),

  // Directory & Project Management
  selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),
  exportProject: (data, defaultDir) =>
    ipcRenderer.invoke("project:export", { data, defaultDir }),
  saveProject: (data, filePath, defaultDir) =>
    ipcRenderer.invoke("project:save", { data, filePath, defaultDir }),
  importProject: (defaultDir) =>
    ipcRenderer.invoke("project:import", { defaultDir }),
  readProjectFromPath: (filePath) =>
    ipcRenderer.invoke("project:read-from-path", filePath),

  // ✅ New: PDF Export (Flattened with drawings)
  savePdf: (data, defaultName) =>
    ipcRenderer.invoke("dialog:savePdf", { data, defaultName }),

  // App Lifecycle & Events
  onAppCloseRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app-close-request", listener);
    return () => ipcRenderer.removeListener("app-close-request", listener);
  },
  forceCloseApp: () => ipcRenderer.send("app-force-close"),

  // File Open Events (from OS double click)
  onOpenPdfFile: (callback) => {
    const listener = (event, filePath) => callback(filePath);
    ipcRenderer.on("open-pdf-file", listener);
    return () => ipcRenderer.removeListener("open-pdf-file", listener);
  },
  onOpenMargynFile: (callback) => {
    const listener = (event, filePath) => callback(filePath);
    ipcRenderer.on("open-margyn-file", listener);
    return () => ipcRenderer.removeListener("open-margyn-file", listener);
  },

  // Shortcuts
  setRecordingShortcut: (isRecording) =>
    ipcRenderer.send("set-recording-shortcut", isRecording),
  onShortcutTriggered: (callback) => {
    const listener = (event, shortcut) => callback(shortcut);
    ipcRenderer.on("shortcut-triggered", listener);
    return () => ipcRenderer.removeListener("shortcut-triggered", listener);
  },
});
