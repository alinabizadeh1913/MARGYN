const { app, BrowserWindow, protocol, net, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

let mainWindow;
const isDev = process.env.NODE_ENV === "development";
const devUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true },
  },
]);

// =========================================================
// MARGYN — Database & File Paths
// =========================================================
const getDbPath = () => path.join(app.getPath("userData"), "margyn.db");

// IPC Handlers for Database Persistence
ipcMain.handle("db-load", async () => {
  const dbPath = getDbPath();
  if (fs.existsSync(dbPath)) {
    return fs.readFileSync(dbPath);
  }
  return null;
});

ipcMain.handle("db-save", async (event, dataBuffer) => {
  const dbPath = getDbPath();
  fs.writeFileSync(dbPath, Buffer.from(dataBuffer));
  return true;
});

// =========================================================
// IPC Handler for PDF File Dialog
// =========================================================
ipcMain.handle("dialog:openPdf", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  });

  if (canceled || filePaths.length === 0) return null;

  // Read the file and return as a Buffer
  const filePath = filePaths[0];
  return fs.readFileSync(filePath);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#09090b", symbolColor: "#a1a1aa", height: 40 },
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
    show: false,
  });

  if (!isDev) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12" || (input.control && input.shift && input.key === "I") || (input.meta && input.alt && input.key === "I")) {
        event.preventDefault();
      }
    });
  }

  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadURL("app://bundle/index.html");
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

function registerCustomProtocol() {
  protocol.handle("app", (request) => {
    const url = request.url.replace("app://", "");
    const [host, ...rest] = url.split("/");
    let filePath = path.join(__dirname, "..", "out", ...rest);
    if (host === "bundle" && (rest.length === 0 || rest[rest.length - 1] === "")) {
      filePath = path.join(__dirname, "..", "out", "index.html");
    }
    if (!path.extname(filePath) && !filePath.endsWith("index.html")) {
      const indexCheck = path.join(filePath, "index.html");
      if (fs.existsSync(indexCheck)) filePath = indexCheck;
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

app.whenReady().then(() => {
  registerCustomProtocol();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});