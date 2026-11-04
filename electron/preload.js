const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  platform: process.platform,
  // Database APIs
  loadDb: () => ipcRenderer.invoke("db-load"),
  saveDb: (data) => ipcRenderer.invoke("db-save", data),
  loadWasm: () => ipcRenderer.invoke("db-load-wasm"),
  // File APIs
  openPdf: () => ipcRenderer.invoke("dialog:openPdf"),
});