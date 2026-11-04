const {
  app,
  BrowserWindow,
  protocol,
  net,
  ipcMain,
  dialog,
  Menu,
  safeStorage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

let mainWindow;
let forceQuit = false;
let pendingFilePath = null;
let isRecordingShortcut = false;

const isDev = process.env.NODE_ENV === "development";
const devUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const filePath = commandLine.find(
        (arg) => arg.endsWith(".margyn") || arg.endsWith(".pdf"),
      );
      if (filePath) {
        if (filePath.endsWith(".margyn")) {
          mainWindow.webContents.send("open-margyn-file", filePath);
        } else if (filePath.toLowerCase().endsWith(".pdf")) {
          mainWindow.webContents.send("open-pdf-file", filePath);
        }
      }
    }
  });
}

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
const getKeyPath = () => path.join(app.getPath("userData"), "margyn.key");

if (!fs.existsSync(getLibraryPath())) {
  try {
    fs.mkdirSync(getLibraryPath(), { recursive: true });
  } catch (e) {}
}

// ✅ کلید رمزنگاری per-install با safeStorage
ipcMain.handle("crypto-get-key", async () => {
  try {
    const keyPath = getKeyPath();

    if (fs.existsSync(keyPath)) {
      const stored = fs.readFileSync(keyPath);
      if (safeStorage.isEncryptionAvailable()) {
        try {
          return safeStorage.decryptString(stored);
        } catch (e) {
          console.error("Failed to decrypt key, regenerating:", e);
        }
      } else {
        return stored.toString("utf-8");
      }
    }

    const newKey = crypto.randomBytes(32).toString("hex");
    const toStore = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(newKey)
      : Buffer.from(newKey, "utf-8");

    fs.writeFileSync(keyPath, toStore);
    return newKey;
  } catch (error) {
    console.error("crypto-get-key failed:", error);
    return crypto.randomBytes(32).toString("hex");
  }
});

ipcMain.on("set-recording-shortcut", (event, isRecording) => {
  isRecordingShortcut = isRecording;
});

ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on("window-close", () => {
  if (mainWindow) mainWindow.close();
});
ipcMain.handle("window-is-maximized", () =>
  mainWindow ? mainWindow.isMaximized() : false,
);

ipcMain.on("app-force-close", () => {
  forceQuit = true;
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("db-load", async () => {
  const dbPath = getDbPath();
  return fs.existsSync(dbPath) ? new Uint8Array(fs.readFileSync(dbPath)) : null;
});
ipcMain.handle("db-save", async (event, dataBuffer) => {
  if (!dataBuffer) return false;
  try {
    await fs.promises.writeFile(getDbPath(), Buffer.from(dataBuffer));
    return true;
  } catch (e) {
    console.error("db-save failed:", e);
    return false;
  }
});
ipcMain.handle("db-load-wasm", async () => {
  const paths = [
    path.join(__dirname, "..", "public", "sql-wasm.wasm"),
    path.join(__dirname, "..", "out", "sql-wasm.wasm"),
  ];
  for (const p of paths)
    if (fs.existsSync(p)) return new Uint8Array(fs.readFileSync(p));
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
  try {
    await fs.promises.writeFile(getPdfPath(), Buffer.from(dataBuffer));
    return true;
  } catch (e) {
    return false;
  }
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

    const hash = crypto.createHash("md5").update(dataBuffer).digest("hex");
    const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const libraryFilePath = path.join(getLibraryPath(), `${hash}-${safeName}`);

    if (!fs.existsSync(libraryFilePath)) {
      fs.writeFileSync(libraryFilePath, dataBuffer);
    }

    return {
      data: new Uint8Array(dataBuffer),
      name: originalName,
      libraryPath: libraryFilePath,
    };
  } catch (error) {
    return null;
  }
});

ipcMain.handle("pdf:read-path", async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;

    const originalName = path.basename(filePath);
    const dataBuffer = fs.readFileSync(filePath);

    const hash = crypto.createHash("md5").update(dataBuffer).digest("hex");
    const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const libraryFilePath = path.join(getLibraryPath(), `${hash}-${safeName}`);

    if (!fs.existsSync(libraryFilePath)) {
      fs.writeFileSync(libraryFilePath, dataBuffer);
    }

    return {
      data: new Uint8Array(dataBuffer),
      name: originalName,
      libraryPath: libraryFilePath,
    };
  } catch (error) {
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
    for (const file of files) fs.unlinkSync(path.join(libPath, file));
  }
  return true;
});

ipcMain.handle("dialog:selectDirectory", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle("project:export", async (event, { data, defaultDir }) => {
  try {
    let defaultName = "Untitled Project.margyn";
    if (data && data.fileName) {
      defaultName = data.fileName.replace(/\.[^/.]+$/, "") + ".margyn";
    }

    const defaultPath = defaultDir
      ? path.join(defaultDir, defaultName)
      : path.join(app.getPath("documents"), defaultName);

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Export Margyn Project",
      defaultPath: defaultPath,
      filters: [{ name: "Margyn Project", extensions: ["margyn"] }],
    });
    if (canceled || !filePath) return null;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  } catch (error) {
    return null;
  }
});

ipcMain.handle(
  "project:save",
  async (event, { data, filePath, defaultDir }) => {
    try {
      let targetPath = filePath;
      if (!targetPath) {
        let defaultName = "Untitled Project.margyn";
        if (data && data.fileName) {
          defaultName = data.fileName.replace(/\.[^/.]+$/, "") + ".margyn";
        }

        const defaultPath = defaultDir
          ? path.join(defaultDir, defaultName)
          : path.join(app.getPath("documents"), defaultName);

        const { canceled, filePath: savePath } = await dialog.showSaveDialog(
          mainWindow,
          {
            title: "Save Margyn Project",
            defaultPath: defaultPath,
            filters: [{ name: "Margyn Project", extensions: ["margyn"] }],
          },
        );
        if (canceled || !savePath) return null;
        targetPath = savePath;
      }
      fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
      return targetPath;
    } catch (error) {
      return null;
    }
  },
);

ipcMain.handle("project:import", async (event, { defaultDir }) => {
  try {
    const defaultPath = defaultDir ? defaultDir : app.getPath("documents");

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Import Margyn Project",
      defaultPath: defaultPath,
      properties: ["openFile"],
      filters: [{ name: "Margyn Project", extensions: ["margyn"] }],
    });
    if (canceled || filePaths.length === 0) return null;

    const rawData = fs.readFileSync(filePaths[0], "utf-8");
    if (!rawData || rawData.trim() === "")
      throw new Error("Empty project file.");

    let parsedData;
    try {
      parsedData = JSON.parse(rawData);
    } catch (parseError) {
      return null;
    }

    return { data: parsedData, filePath: filePaths[0] };
  } catch (error) {
    return null;
  }
});

ipcMain.handle("project:read-from-path", async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const rawData = fs.readFileSync(filePath, "utf-8");
    if (!rawData || rawData.trim() === "") return null;
    return { data: JSON.parse(rawData), filePath };
  } catch (error) {
    console.error("Failed to read project file:", error);
    return null;
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1440,
    minHeight: 900,
    titleBarStyle: "hidden",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      devTools: false,
    },
    show: false,
  });

  mainWindow.maximize();

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (
      input.type === "keyDown" &&
      (input.control || input.meta) &&
      input.key.toLowerCase() === "w"
    ) {
      if (!isRecordingShortcut) {
        event.preventDefault();
        mainWindow.webContents.send("shortcut-triggered", "ctrl+w");
      }
      return;
    }

    if (
      input.key === "F12" ||
      (input.control &&
        input.shift &&
        ["i", "c", "j"].includes(input.key.toLowerCase()))
    ) {
      event.preventDefault();
      return;
    }
  });

  mainWindow.webContents.on("context-menu", (e) => e.preventDefault());

  mainWindow.on("close", (e) => {
    if (!forceQuit) {
      e.preventDefault();
      mainWindow.webContents.send("app-close-request");
    }
  });

  if (isDev) mainWindow.loadURL(devUrl);
  else mainWindow.loadURL("app://bundle/index.html");

  mainWindow.webContents.on("did-finish-load", () => {
    if (pendingFilePath) {
      if (pendingFilePath.endsWith(".margyn")) {
        mainWindow.webContents.send("open-margyn-file", pendingFilePath);
      } else if (pendingFilePath.toLowerCase().endsWith(".pdf")) {
        mainWindow.webContents.send("open-pdf-file", pendingFilePath);
      }
      pendingFilePath = null;
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerCustomProtocol() {
  protocol.handle("app", (request) => {
    const url = request.url.replace("app://", "");
    const [host, ...rest] = url.split("/");

    let filePath = path.join(__dirname, "..", "out", host, ...rest);

    if (host === "bundle") {
      filePath = path.join(__dirname, "..", "out", ...rest);
      if (rest.length === 0 || rest[rest.length - 1] === "") {
        filePath = path.join(__dirname, "..", "out", "index.html");
      }
    }

    if (!path.extname(filePath) && !filePath.endsWith("index.html")) {
      const indexCheck = path.join(filePath, "index.html");
      if (fs.existsSync(indexCheck)) filePath = indexCheck;
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

const args = process.argv.slice(1);
const fileArg = args.find(
  (arg) => arg.endsWith(".margyn") || arg.toLowerCase().endsWith(".pdf"),
);
if (fileArg && fs.existsSync(fileArg)) {
  pendingFilePath = fileArg;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerCustomProtocol();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ✅ اطمینان از flush نهایی قبل از بستن
app.on("before-quit", (e) => {
  if (!forceQuit && mainWindow) {
    e.preventDefault();
    mainWindow.webContents.send("app-close-request");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
