const { contextBridge, ipcRenderer } = require("electron");

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

  // Updated openPdf returns metadata now
  openPdf: () => ipcRenderer.invoke("dialog:openPdf"),

  // Library
  loadLibraryFile: (path) => ipcRenderer.invoke("library-load-file", path),
  deleteLibraryFile: (path) => ipcRenderer.invoke("library-delete-file", path),
  clearLibraryFolder: () => ipcRenderer.invoke("library-clear-all"),
});
