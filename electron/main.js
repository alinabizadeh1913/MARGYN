const {
  app,
  BrowserWindow,
  protocol,
  net,
  ipcMain,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

let mainWindow;
const isDev = process.env.NODE_ENV === "development";
const devUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

// Paths
const getDbPath = () => path.join(app.getPath("userData"), "margyn.db");
const getPdfPath = () =>
  path.join(app.getPath("userData"), "active_document.pdf");

// IPC Handlers — Database
ipcMain.handle("db-load", async () => {
  const dbPath = getDbPath();
  return fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
});

ipcMain.handle("db-save", async (event, dataBuffer) => {
  fs.writeFileSync(getDbPath(), Buffer.from(dataBuffer));
  return true;
});

ipcMain.handle("db-load-wasm", async () => {
  const possiblePaths = [
    path.join(__dirname, "..", "public", "sql-wasm.wasm"),
    path.join(__dirname, "..", "out", "sql-wasm.wasm"),
  ];
  for (const wasmPath of possiblePaths) {
    if (fs.existsSync(wasmPath)) return fs.readFileSync(wasmPath);
  }
  throw new Error("Could not find sql-wasm.wasm");
});

// IPC Handlers — Active PDF
ipcMain.handle("pdf-load-active", async () => {
  const pdfPath = getPdfPath();
  return fs.existsSync(pdfPath) ? fs.readFileSync(pdfPath) : null;
});

ipcMain.handle("pdf-save-active", async (event, dataBuffer) => {
  fs.writeFileSync(getPdfPath(), Buffer.from(dataBuffer));
  return true;
});

ipcMain.handle("pdf-clear-active", async () => {
  const pdfPath = getPdfPath();
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  return true;
});

ipcMain.handle("dialog:openPdf", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  });
  if (canceled || filePaths.length === 0) return null;
  return fs.readFileSync(filePaths[0]);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
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
    show: false, // برای جلوگیری از پرش و صفحه سیاه اولیه
  });

  mainWindow.maximize();

  if (!isDev) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (
        input.key === "F12" ||
        (input.control && input.shift && input.key === "I") ||
        (input.meta && input.alt && input.key === "I")
      ) {
        event.preventDefault();
      }
    });
  }

  if (isDev) {
    mainWindow.loadURL(devUrl);
    // mainWindow.webContents.openDevTools(); // در صورت نیاز برای دیباگ باز شود
  } else {
    mainWindow.loadURL("app://bundle/index.html");
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerCustomProtocol() {
  protocol.handle("app", (request) => {
    const url = request.url.replace("app://", "");
    const [host, ...rest] = url.split("/");
    let filePath = path.join(__dirname, "..", "out", ...rest);

    if (
      host === "bundle" &&
      (rest.length === 0 || rest[rest.length - 1] === "")
    ) {
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
