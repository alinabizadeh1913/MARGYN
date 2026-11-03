#!/usr/bin/env node
/**
 * MARGYN - Clean extra files
 * ---------------------------
 * Safely removes build artifacts, caches, and logs.
 * CRITICAL: Never touches node_modules (except internal caches).
 * usage: npm run clean
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Only safe directories to remove
const DIRS = [
  ".next",
  "out",
  "release",
  "node_modules/.cache",
  "node_modules/.vite",
  "node_modules/.turbo",
];

const FILES = [
  "build-debug.log",
  "build-debug2.log",
  "build-debug3.log",
  "build-final.log",
  "painda-debug.log",
  "tsconfig.tsbuildinfo",
  ".eslintcache",
  "npm-debug.log",
  "yarn-error.log",
];

const colors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
};

function log(msg, color) {
  console.log((colors[color] || "") + msg + colors.reset);
}

function rmrf(p) {
  // Safety check: Prevent deleting the root node_modules entirely
  const normalized = p.replace(/\\/g, "/");
  if (normalized.endsWith("node_modules") || normalized === "node_modules") {
    log(`   ⚠️ Refused to delete node_modules`, "red");
    return false;
  }

  if (!fs.existsSync(p)) return false;
  fs.rmSync(p, { recursive: true, force: true });
  return true;
}

function rmf(p) {
  if (!fs.existsSync(p)) return false;
  fs.rmSync(p, { force: true });
  return true;
}

log("\n🧹 MARGYN Cleanup\n", "cyan");

let removed = 0;

for (const d of DIRS) {
  const full = path.join(ROOT, d);
  if (rmrf(full)) {
    log(`   ✅ removed dir: ${d}`, "green");
    removed++;
  }
}

for (const f of FILES) {
  const full = path.join(ROOT, f);
  if (rmf(full)) {
    log(`   ✅ removed file: ${f}`, "green");
    removed++;
  }
}

// Clean *.log files in root (depth=1 only)
try {
  for (const entry of fs.readdirSync(ROOT)) {
    const full = path.join(ROOT, entry);
    const st = fs.statSync(full);
    if (st.isFile() && entry.endsWith(".log")) {
      fs.rmSync(full, { force: true });
      log(`   ✅ removed file: ${entry}`, "green");
      removed++;
    }
  }
} catch (err) {}

if (removed === 0) {
  log("   ✨ already clean", "yellow");
} else {
  log(`\n🎉 Done. ${removed} item(s) removed.\n`, "green");
}