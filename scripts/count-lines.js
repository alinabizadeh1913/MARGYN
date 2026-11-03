#!/usr/bin/env node
/* ============================================================
   MARGYN · Line Counter
   ------------------------------------------------------------
   A polished, dependency-free source counter.

   · Recursively walks the project tree.
   · Ignores build artefacts, caches, and lockfiles.
   · Splits every file into Code / Blank / Comment lines.
   · Prints a colourised directory + language breakdown,
     a summary with percentage bars, and the top files.

   It NEVER writes, renames, moves, or deletes anything.
   Only fs.readdirSync / fs.readFileSync / fs.existsSync.

   Usage
   -----
     node scripts/count-lines.js
     node scripts/count-lines.js --no-color
     node scripts/count-lines.js --top=20
     node scripts/count-lines.js --root=src
============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");

/* ============================================================
   1 · ARGUMENT PARSING
============================================================ */

const argv = process.argv.slice(2);

const getFlag = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};

const hasFlag = (name) => argv.includes(`--${name}`);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TARGET_ROOT = getFlag("root")
  ? path.resolve(PROJECT_ROOT, getFlag("root"))
  : PROJECT_ROOT;

const TOP_FILES = Math.max(1, parseInt(getFlag("top", "10"), 10) || 10);
const USE_COLOR = !hasFlag("no-color") && process.stdout.isTTY !== false;

/* ============================================================
   2 · ANSI PALETTE
============================================================ */

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const paint = (color, text) =>
  USE_COLOR ? `${color}${text}${ANSI.reset}` : String(text);

const strip = (text) => String(text).replace(/\x1b\[[0-9;]*m/g, "");

/* ============================================================
   3 · LAYOUT PRIMITIVES
============================================================ */

const WIDTH = 74;

const hr = (char = "─") => paint(ANSI.gray, char.repeat(WIDTH));

const line = (content = "") => `  ${content}`;

const padEnd = (text, width) => {
  const visible = strip(text).length;
  return text + " ".repeat(Math.max(0, width - visible));
};

const padStart = (text, width) => {
  const visible = strip(text).length;
  return " ".repeat(Math.max(0, width - visible)) + text;
};

const thousands = (n) => n.toLocaleString("en-US");

const bytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const pct = (part, whole) => {
  if (whole <= 0) return "0.0%";
  return ((part / whole) * 100).toFixed(1) + "%";
};

const bar = (ratio, width = 24) => {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
};

/* ============================================================
   4 · FILE CLASSIFICATION
============================================================ */

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  ".vscode",
  ".idea",
  ".husky",
  ".github",
  "out",
  "dist",
  "build",
  "release",
  "coverage",
  "tmp",
  "temp",
  "vendor",
  "__snapshots__",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "npm-shrinkwrap.json",
  "tsconfig.tsbuildinfo",
  ".eslintcache",
]);

const COUNTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".json",
  ".md",
  ".sql",
  ".yml",
  ".yaml",
]);

const LANGUAGE_NAMES = {
  ".ts": "TypeScript",
  ".tsx": "React · TSX",
  ".js": "JavaScript",
  ".jsx": "React · JSX",
  ".mjs": "ES Module",
  ".cjs": "CommonJS",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".html": "HTML",
  ".json": "JSON",
  ".md": "Markdown",
  ".sql": "SQL",
  ".yml": "YAML",
  ".yaml": "YAML",
};

/* ============================================================
   5 · LINE CLASSIFICATION
============================================================ */

const isNonCode = (line) => {
  const t = line.trim();
  if (t === "") return true;
  if (t.startsWith("//")) return true;
  if (t.startsWith("/*")) return true;
  if (t.startsWith("*")) return true;
  if (t.startsWith("*/")) return true;
  if (t.startsWith("#") && !t.startsWith("#!")) return true;
  if (t.startsWith("<!--")) return true;
  return false;
};

const countPhysicalLines = (text) => {
  if (text.length === 0) return 0;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++;
  }
  return n;
};

/* ============================================================
   6 · FILE WALKER
============================================================ */

const collectFiles = (dir, bucket) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      collectFiles(absolute, bucket);
      continue;
    }

    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    if (entry.name.endsWith(".min.js")) continue;
    if (entry.name.endsWith(".min.css")) continue;
    if (entry.name.endsWith(".d.ts")) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!COUNTED_EXTENSIONS.has(ext)) continue;

    let content;
    try {
      content = fs.readFileSync(absolute, "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    let code = 0;
    let blank = 0;
    let comment = 0;

    for (const raw of lines) {
      if (raw.trim() === "") blank++;
      else if (isNonCode(raw)) comment++;
      else code++;
    }

    bucket.push({
      absolute,
      relative: path.relative(PROJECT_ROOT, absolute).replace(/\\/g, "/"),
      extension: ext,
      total: countPhysicalLines(content),
      code,
      blank,
      comment,
      bytes: Buffer.byteLength(content, "utf8"),
    });
  }
};

/* ============================================================
   7 · AGGREGATION
============================================================ */

const emptyStat = () => ({
  files: 0,
  total: 0,
  code: 0,
  blank: 0,
  comment: 0,
  bytes: 0,
});

const accumulate = (map, key, file) => {
  const stat = map.get(key) ?? emptyStat();
  stat.files += 1;
  stat.total += file.total;
  stat.code += file.code;
  stat.blank += file.blank;
  stat.comment += file.comment;
  stat.bytes += file.bytes;
  map.set(key, stat);
};

const summarise = (files) => {
  const byDirectory = new Map();
  const byLanguage = new Map();

  let total = 0;
  let code = 0;
  let blank = 0;
  let comment = 0;
  let bytesTotal = 0;

  for (const file of files) {
    total += file.total;
    code += file.code;
    blank += file.blank;
    comment += file.comment;
    bytesTotal += file.bytes;

    const segments = file.relative.split("/");
    const top = segments.length > 1 ? segments[0] : "(root)";
    const sub = segments.length > 2 ? `${top}/${segments[1]}` : top;
    accumulate(byDirectory, sub, file);

    accumulate(byLanguage, file.extension, file);
  }

  return {
    total,
    code,
    blank,
    comment,
    bytes: bytesTotal,
    files: files.length,
    byDirectory,
    byLanguage,
  };
};

/* ============================================================
   8 · RENDERING
============================================================ */

const renderHeader = () => {
  const title = "MARGYN · Source Statistics";
  const inner = `  ${title}${" ".repeat(
    Math.max(0, WIDTH - title.length - 4)
  )}`;
  const top = "╔" + "═".repeat(WIDTH) + "╗";
  const bot = "╚" + "═".repeat(WIDTH) + "╝";

  console.log("");
  console.log(line(paint(ANSI.cyan + ANSI.bold, top)));
  console.log(
    line(
      paint(ANSI.cyan + ANSI.bold, "║") +
        paint(ANSI.bold + ANSI.white, inner) +
        paint(ANSI.cyan + ANSI.bold, "║")
    )
  );
  console.log(line(paint(ANSI.cyan + ANSI.bold, bot)));
  console.log("");
};

const renderTableHeader = (columns) => {
  const cells = columns.map((c) => paint(ANSI.gray, c));
  console.log(line(cells.join("")));
};

const renderSection = (title) => {
  console.log("");
  console.log(line(paint(ANSI.bold + ANSI.magenta, title)));
  console.log(line(hr()));
};

const renderDirectories = (map) => {
  renderSection("📁  By Directory");

  renderTableHeader([
    padEnd("Path", 36),
    padStart("Files", 8),
    padStart("Lines", 10),
    padStart("Code", 10),
  ]);

  console.log(line(hr()));

  const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total);

  for (const [name, stat] of rows) {
    console.log(
      line(
        padEnd(paint(ANSI.white, name), 36) +
          padStart(paint(ANSI.cyan, thousands(stat.files)), 8) +
          padStart(paint(ANSI.yellow, thousands(stat.total)), 10) +
          padStart(paint(ANSI.green, thousands(stat.code)), 10)
      )
    );
  }

  console.log(line(hr()));
};

const renderLanguages = (map) => {
  renderSection("🧩  By Language");

  renderTableHeader([
    padEnd("Language", 20),
    padStart("Files", 8),
    padStart("Lines", 10),
    padStart("Code", 10),
    padStart("Size", 10),
  ]);

  console.log(line(hr()));

  const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total);

  for (const [ext, stat] of rows) {
    const name = LANGUAGE_NAMES[ext] ?? ext;
    console.log(
      line(
        padEnd(paint(ANSI.white, name), 20) +
          padStart(paint(ANSI.cyan, thousands(stat.files)), 8) +
          padStart(paint(ANSI.yellow, thousands(stat.total)), 10) +
          padStart(paint(ANSI.green, thousands(stat.code)), 10) +
          padStart(paint(ANSI.gray, bytes(stat.bytes)), 10)
      )
    );
  }

  console.log(line(hr()));
};

const renderMetricRow = (label, value, ratio, color) => {
  console.log(
    line(
      padEnd(paint(color, label), 18) +
        padStart(paint(ANSI.bold + ANSI.white, thousands(value)), 10) +
        "   " +
        paint(color, bar(ratio)) +
        "  " +
        paint(ANSI.gray, pct(value, stats.total).padStart(6))
    )
  );
};

let stats; /* bound once in main() for the bar helper above */

const renderSummary = () => {
  renderSection("📊  Summary");

  console.log(
    line(
      padEnd(paint(ANSI.gray, "Total Files"), 18) +
        padStart(paint(ANSI.bold + ANSI.cyan, thousands(stats.files)), 10)
    )
  );
  console.log(
    line(
      padEnd(paint(ANSI.gray, "Total Lines"), 18) +
        padStart(paint(ANSI.bold + ANSI.white, thousands(stats.total)), 10)
    )
  );

  console.log(line(""));

  renderMetricRow("Code", stats.code, stats.code / stats.total, ANSI.green);
  renderMetricRow("Blank", stats.blank, stats.blank / stats.total, ANSI.gray);
  renderMetricRow(
    "Comments",
    stats.comment,
    stats.comment / stats.total,
    ANSI.blue
  );

  console.log(line(""));
  console.log(
    line(
      padEnd(paint(ANSI.gray, "Total Size"), 18) +
        padStart(paint(ANSI.gray, bytes(stats.bytes)), 10)
    )
  );

  console.log(line(hr()));
};

const renderBanner = () => {
  const sentence = `✦  ${thousands(
    stats.total
  )} lines of code across ${thousands(stats.files)} files  ✦`;
  const width = sentence.length + 4;

  console.log("");
  console.log(
    line(paint(ANSI.cyan + ANSI.bold, "╔" + "═".repeat(width) + "╗"))
  );
  console.log(
    line(
      paint(ANSI.cyan + ANSI.bold, "║") +
        "  " +
        paint(ANSI.bold + ANSI.white, sentence) +
        "  " +
        paint(ANSI.cyan + ANSI.bold, "║")
    )
  );
  console.log(
    line(paint(ANSI.cyan + ANSI.bold, "╚" + "═".repeat(width) + "╝"))
  );
  console.log("");
};

const renderTopFiles = (files) => {
  if (files.length === 0) return;

  renderSection(`🔥  Top ${TOP_FILES} Largest Files`);

  const top = [...files].sort((a, b) => b.total - a.total).slice(0, TOP_FILES);
  const longest = Math.max(...top.map((f) => f.relative.length));

  for (let i = 0; i < top.length; i++) {
    const f = top[i];
    const rank = String(i + 1).padStart(2, " ");
    const lines = padStart(paint(ANSI.yellow, thousands(f.total)), 8);
    const p = paint(ANSI.gray, padEnd(f.relative, longest));
    console.log(line(`${paint(ANSI.gray, rank)}  ${lines}  ${p}`));
  }

  console.log(line(hr()));
};

/* ============================================================
   9 · MAIN
============================================================ */

const main = () => {
  const startedAt = Date.now();

  renderHeader();

  if (!fs.existsSync(TARGET_ROOT)) {
    console.error(line(paint(ANSI.red, `✖ Root not found: ${TARGET_ROOT}`)));
    process.exit(1);
  }

  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let tick = 0;

  const timer = setInterval(() => {
    process.stdout.write(
      `\r  ${paint(ANSI.gray, "Scanning")} ${paint(
        ANSI.cyan,
        spinner[tick++ % spinner.length]
      )} `
    );
  }, 60);

  const bucket = [];
  collectFiles(TARGET_ROOT, bucket);

  clearInterval(timer);
  process.stdout.write("\r" + " ".repeat(WIDTH) + "\r");

  stats = summarise(bucket);

  renderDirectories(stats.byDirectory);
  renderLanguages(stats.byLanguage);
  renderSummary();
  renderBanner();
  renderTopFiles(bucket);

  const elapsed = Date.now() - startedAt;
  console.log(
    line(
      paint(
        ANSI.gray,
        `⏱  Scanned ${thousands(stats.files)} files in ${elapsed} ms`
      )
    )
  );
  console.log(line(paint(ANSI.gray, `📍 Root: ${TARGET_ROOT}`)));
  console.log("");
};

main();