#!/usr/bin/env node
/**
 * MARGYN - electron-builder auto-patcher
 * ----------------------------------------
 * Auto-patches electron-builder after npm install to use
 * local mirrors instead of downloading from GitHub.
 *
 * Required external files:
 *   C:\eb-mirror\nsis-3.0.4.1\nsis-3.0.4.1.7z
 *   C:\eb-mirror\nsis-resources-3.4.1\nsis-resources-3.4.1.7z
 *   C:\eb-mirror\winCodeSign-2.6.0\winCodeSign-2.6.0.7z
 *   C:\eb-cache\electron-dist\electron.exe
 *
 * System requirement:
 *   7-Zip installed at C:\Program Files\7-Zip\7z.exe
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const ABL_OUT = path.join(ROOT, "node_modules", "app-builder-lib", "out");

const BIN_DOWNLOAD_PATH = path.join(ABL_OUT, "binDownload.js");
const SEVEN_ZIP_PATH = path.join(ABL_OUT, "toolsets", "7zip.js");

const MIRROR = "C:\\eb-mirror";
const ELECTRON_DIST = "C:\\eb-cache\\electron-dist";
const SEVEN_Z = "C:\\Program Files\\7-Zip\\7z.exe";

/* ============================================================
   Patch Contents
============================================================ */

const BIN_DOWNLOAD_CONTENT = `/* MARGYN PATCH - DO NOT EDIT */
/* This file was auto-patched by scripts/patch-electron-builder.js */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const MIRROR = ${JSON.stringify(MIRROR)};
const SEVEN_Z = ${JSON.stringify(SEVEN_Z)};

function findArchive(name, version) {
  const all = [];
  const walk = (d) => {
    try {
      for (const e of fs.readdirSync(d)) {
        const full = path.join(d, e);
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full);
        else if (e.endsWith(".7z")) all.push(full);
      }
    } catch (err) {}
  };
  walk(MIRROR);
  const key = (name + " " + version).toLowerCase();
  let best = null, bestScore = 0;
  for (const f of all) {
    const b = path.basename(f).toLowerCase();
    let score = 0;
    if (key.includes("wincodesign") && b.includes("wincodesign")) score = 100;
    else if (key.includes("nsis-resources") && b.includes("nsis-resources")) score = 100;
    else if (key.includes("nsis") && b.includes("nsis") && !b.includes("resources")) score = 90;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best;
}

function findDirWithSub(d, sub, file) {
  try {
    if (fs.existsSync(path.join(d, sub, file))) return d;
    for (const e of fs.readdirSync(d)) {
      const full = path.join(d, e);
      try {
        if (fs.statSync(full).isDirectory()) {
          const r = findDirWithSub(full, sub, file);
          if (r) return r;
        }
      } catch (err) {}
    }
  } catch (err) {}
  return null;
}

function findDirWithFile(d, file) {
  try {
    if (fs.existsSync(path.join(d, file))) return d;
    for (const e of fs.readdirSync(d)) {
      const full = path.join(d, e);
      try {
        if (fs.statSync(full).isDirectory()) {
          const r = findDirWithFile(full, file);
          if (r) return r;
        }
      } catch (err) {}
    }
  } catch (err) {}
  return null;
}

function extract(archive, dest) {
  fs.mkdirSync(dest, { recursive: true });
  execFileSync(SEVEN_Z, ["x", archive, "-o" + dest, "-y"], { stdio: "ignore" });
}

exports.getBinFromUrl = async function (name, version) {
  const low = (name + " " + version).toLowerCase();

  if (low.includes("wincodesign")) {
    const archive = findArchive(name, version);
    if (!archive) throw new Error("[PATCHED] No archive for " + name + " / " + version);
    console.log("[PATCHED] ->", archive);
    const tmp = path.join(os.tmpdir(), "eb-wcs-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    extract(archive, tmp);
    return findDirWithFile(tmp, "rcedit-x64.exe") || tmp;
  }

  if (low.includes("nsis") && !low.includes("resources")) {
    const nsisArchive = findArchive("nsis", version);
    if (!nsisArchive) throw new Error("[PATCHED] No nsis archive");
    console.log("[PATCHED] ->", nsisArchive);
    const tmp = path.join(os.tmpdir(), "eb-nsis-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    extract(nsisArchive, tmp);
    const nsisRoot = findDirWithSub(tmp, "Bin", "makensis.exe");
    if (!nsisRoot) throw new Error("[PATCHED] Could not find NSIS root");
    console.log("[PATCHED] NSIS root:", nsisRoot);

    const nsisResArchive = findArchive("nsis-resources", "3.4.1");
    if (nsisResArchive) {
      console.log("[PATCHED] Merging nsis-resources:", nsisResArchive);
      const nrTmp = path.join(os.tmpdir(), "eb-nr-" + Date.now() + "-" + Math.random().toString(36).slice(2));
      extract(nsisResArchive, nrTmp);
      const nrRoot = findDirWithSub(nrTmp, "plugins", "x86-unicode");
      if (nrRoot) {
        const srcPlugins = path.join(nrRoot, "plugins");
        const dstPlugins = path.join(nsisRoot, "Plugins");
        fs.mkdirSync(dstPlugins, { recursive: true });
        try {
          fs.cpSync(srcPlugins, dstPlugins, { recursive: true, force: true });
          console.log("[PATCHED] Plugins merged ->", dstPlugins);
        } catch (e) {
          console.error("[PATCHED] Merge failed:", e.message);
        }
      }
    }
    return nsisRoot;
  }

  if (low.includes("nsis-resources")) {
    const archive = findArchive(name, version);
    if (!archive) throw new Error("[PATCHED] No archive");
    console.log("[PATCHED] ->", archive);
    const tmp = path.join(os.tmpdir(), "eb-nr2-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    extract(archive, tmp);
    return findDirWithSub(tmp, "plugins", "x86-unicode") || tmp;
  }

  throw new Error("[PATCHED] Unknown toolset: " + name + " / " + version);
};

exports.download = async function () {
  throw new Error("[PATCHED] download disabled");
};
`;

const SEVEN_ZIP_CONTENT = `/* MARGYN PATCH - DO NOT EDIT */
/* This file was auto-patched by scripts/patch-electron-builder.js */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPath7za = getPath7za;

const fs = require("fs");

const SYSTEM_7Z = ${JSON.stringify(SEVEN_Z)};

async function getPath7za() {
  if (!fs.existsSync(SYSTEM_7Z)) {
    throw new Error("[PATCHED-7ZIP] 7-Zip not found at " + SYSTEM_7Z);
  }
  console.log("[PATCHED-7ZIP] Using system 7-Zip: " + SYSTEM_7Z);
  return SYSTEM_7Z;
}
`;

/* ============================================================
   Main Logic
============================================================ */

function log(msg, color) {
  const colors = {
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    reset: "\x1b[0m",
  };
  console.log((colors[color] || "") + msg + colors.reset);
}

function ensureBackup(filePath) {
  const backup = filePath + ".orig";
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(filePath, backup);
  }
  return backup;
}

function applyPatch(filePath, content, label) {
  if (!fs.existsSync(filePath)) {
    log(`   ⚠️  ${label} not found (skipped)`, "yellow");
    return false;
  }

  const existing = fs.readFileSync(filePath, "utf8");

  if (existing.includes("MARGYN PATCH - DO NOT EDIT")) {
    log(`   ✅ ${label} already patched`, "green");
    return true;
  }

  ensureBackup(filePath);
  fs.writeFileSync(filePath, content, "utf8");
  log(`   ✅ ${label} patched`, "green");
  return true;
}

function checkPrerequisites() {
  const problems = [];

  if (!fs.existsSync(MIRROR)) {
    problems.push(`   ❌ ${MIRROR} not found`);
  } else {
    const expected = [
      "nsis-3.0.4.1",
      "nsis-resources-3.4.1",
      "winCodeSign-2.6.0",
    ];
    for (const name of expected) {
      const dir = path.join(MIRROR, name);
      if (!fs.existsSync(dir)) {
        problems.push(`   ❌ ${dir} not found`);
      }
    }
  }

  if (!fs.existsSync(ELECTRON_DIST)) {
    problems.push(`   ❌ ${ELECTRON_DIST} not found`);
  }

  if (!fs.existsSync(SEVEN_Z)) {
    problems.push(`   ❌ 7-Zip not found at ${SEVEN_Z}`);
  }

  return problems;
}

function main() {
  log("", "reset");
  log("╔══════════════════════════════════════════════════════╗", "cyan");
  log("║  MARGYN - electron-builder auto-patcher              ║", "cyan");
  log("╚══════════════════════════════════════════════════════╝", "cyan");
  log("", "reset");

  const problems = checkPrerequisites();

  if (problems.length > 0) {
    log("⚠️  Prerequisites missing:", "yellow");
    problems.forEach((p) => log(p, "red"));
    log("", "reset");
    log(
      "   To build these files automatically, run this in PowerShell:",
      "cyan"
    );
    log("     npm run setup:mirror", "cyan");
    log("", "reset");
    log(
      "   (Patch is applied, but build will fail until these exist)",
      "yellow"
    );
    log("", "reset");
  }

  log("📦 Applying patches to electron-builder...", "cyan");
  applyPatch(BIN_DOWNLOAD_PATH, BIN_DOWNLOAD_CONTENT, "binDownload.js");
  applyPatch(SEVEN_ZIP_PATH, SEVEN_ZIP_CONTENT, "7zip.js");

  log("", "reset");
  if (problems.length === 0) {
    log("🎉 All good! Ready to build:", "green");
    log("   npm run electron:build:win", "green");
  } else {
    log("⚠️  Patches applied, but prerequisites are missing.", "yellow");
  }
  log("", "reset");
}

try {
  main();
} catch (err) {
  console.error("\x1b[31m[PATCH] Unexpected error:\x1b[0m", err);
}

process.exit(0);