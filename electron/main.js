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

const getDbPath = () => path.join(app.getPath("userData"), "margyn.db");
const getPdfPath = () =>
  path.join(app.getPath("userData"), "active_document.pdf");
const getLibraryPath = () => path.join(app.getPath("userData"), "library");

if (!fs.existsSync(getLibraryPath())) {
  try {
    fs.mkdirSync(getLibraryPath(), { recursive: true });
  } catch (e) {
    console.error("Could not create library folder", e);
  }
}

ipcMain.handle("db-load", async () => {
  const dbPath = getDbPath();
  return fs.existsSync(dbPath) ? new Uint8Array(fs.readFileSync(dbPath)) : null;
});

ipcMain.handle("db-save", async (event, dataBuffer) => {
  if (!dataBuffer) return false;
  fs.writeFileSync(getDbPath(), Buffer.from(dataBuffer));
  return true;
});

ipcMain.handle("db-load-wasm", async () => {
  const possiblePaths = [
    path.join(__dirname, "..", "public", "sql-wasm.wasm"),
    path.join(__dirname, "..", "out", "sql-wasm.wasm"),
  ];
  for (const wasmPath of possiblePaths) {
    if (fs.existsSync(wasmPath))
      return new Uint8Array(fs.readFileSync(wasmPath));
  }
  throw new Error("Could not find sql-wasm.wasm");
});

ipcMain.handle("pdf-load-active", async () => {
  const pdfPath = getPdfPath();
  return fs.existsSync(pdfPath)
    ? new Uint8Array(fs.readFileSync(pdfPath))
    : null;
});

ipcMain.handle("pdf-save-active", async (event, dataBuffer) => {
  if (!dataBuffer) return false;
  fs.writeFileSync(getPdfPath(), Buffer.from(dataBuffer));
  return true;
});

ipcMain.handle("pdf-clear-active", async () => {
  const pdfPath = getPdfPath();
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  return true;
});

ipcMain.handle("dialog:openPdf", async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
    });
    if (canceled || filePaths.length === 0) return null;

    const originalPath = filePaths[0];
    const originalName = path.basename(originalPath);
    const dataBuffer = fs.readFileSync(originalPath);

    const uniqueId =
      Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const libraryFilePath = path.join(
      getLibraryPath(),
      `${uniqueId}-${safeName}`,
    );

    fs.writeFileSync(libraryFilePath, dataBuffer);

    return {
      data: new Uint8Array(dataBuffer),
      name: originalName,
      libraryPath: libraryFilePath,
    };
  } catch (error) {
    console.error("Failed to open PDF:", error);
    return null;
  }
});

ipcMain.handle("library-load-file", async (event, filePath) => {
  try {
    if (fs.existsSync(filePath))
      return new Uint8Array(fs.readFileSync(filePath));
    return null;
  } catch (error) {
    return null;
  }
});

ipcMain.handle("library-delete-file", async (event, filePath) => {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

ipcMain.handle("library-clear-all", async () => {
  const libPath = getLibraryPath();
  if (fs.existsSync(libPath)) {
    const files = fs.readdirSync(libPath);
    for (const file of files) {
      fs.unlinkSync(path.join(libPath, file));
    }
  }
  return true;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1440, // افزایش حداقل عرض از 1280 به 1440
    minHeight: 900, // افزایش حداقل ارتفاع از 800 به 900
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
  } else {
    mainWindow.loadURL("app://bundle/index.html");
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
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
