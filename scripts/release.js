#!/usr/bin/env node
/**
 * MARGYN · Ultimate Release Pipeline
 * -----------------------------------
 * Automates cleaning, TypeScript checking, line counting,
 * Git committing, and Electron building with a polished CLI UI.
 * Filters build logs to show only essential errors and warnings.
 */

const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/* =========================================================
   ANSI Terminal Colors & Typography
========================================================= */
const C = {
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
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
};

const log = (msg) => console.log(`  ${msg}`);
const blank = () => console.log("");

const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, "");

const drawBox = (title, contentLines) => {
  const maxLen = Math.max(
    stripAnsi(title).length,
    ...contentLines.map((l) => stripAnsi(l).length),
  );
  const width = Math.max(64, maxLen + 4);

  log(`${C.cyan}${C.bold}╔${"═".repeat(width - 2)}╗${C.reset}`);
  log(
    `${C.cyan}${C.bold}║${C.reset} ${C.bold}${C.white}${title.padEnd(width - 4)}${C.reset} ${C.cyan}${C.bold}║${C.reset}`,
  );
  log(`${C.cyan}${C.bold}╠${"═".repeat(width - 2)}╣${C.reset}`);

  for (const line of contentLines) {
    const cleanLen = stripAnsi(line).length;
    const padding = " ".repeat(Math.max(0, width - cleanLen - 3));
    log(
      `${C.cyan}${C.bold}║${C.reset} ${line}${padding}${C.cyan}${C.bold}║${C.reset}`,
    );
  }

  log(`${C.cyan}${C.bold}╚${"═".repeat(width - 2)}╝${C.reset}`);
};

/* =========================================================
   Execution Helper
========================================================= */
const runCmd = (cmd, label, hideOutput = false) => {
  process.stdout.write(
    `  ${C.cyan}⚡${C.reset} ${C.bold}${label.padEnd(34)}${C.reset} `,
  );
  try {
    const output = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: hideOutput ? "pipe" : "inherit",
    });
    if (hideOutput) console.log(`${C.green}✔ Done${C.reset}`);
    return { success: true, output: output || "" };
  } catch (error) {
    if (hideOutput) console.log(`${C.red}✖ Failed${C.reset}`);
    return {
      success: false,
      output: (error.stdout || "") + (error.stderr || ""),
    };
  }
};

/* =========================================================
   Parsers
========================================================= */

const parseTscOutput = (output) => {
  if (!output || !output.trim()) return { hasErrors: false, errors: [] };

  const lines = output.split("\n");
  const errors = [];
  const errorRegex = /error TS\d+: (.+)/;

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match && match[1]) {
      let msg =
        match[1].length > 70 ? match[1].substring(0, 70) + "..." : match[1];
      errors.push(msg);
    }
  }

  return { hasErrors: errors.length > 0, errors };
};

const parseBuildOutput = (output) => {
  const lines = output.split("\n");
  const errors = [];
  const warnings = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const lower = line.toLowerCase();

    if (lower.includes("0 errors") || lower.includes("0 warnings")) continue;

    if (lower.includes("error") || lower.includes("failed")) {
      let type = line.length > 65 ? line.substring(0, 65) + "..." : line;
      if (line.includes(":") && line.indexOf(":") < 40) {
        type = line.split(":")[1].trim();
      }
      errors.push(type);
    } else if (lower.includes("warn")) {
      let type = line.length > 65 ? line.substring(0, 65) + "..." : line;
      warnings.push(type);
    }
  }

  const deduplicate = (arr) => {
    const map = {};
    arr.forEach((item) => (map[item] = (map[item] || 0) + 1));
    return map;
  };

  return {
    errorMap: deduplicate(errors),
    warningMap: deduplicate(warnings),
    totalErrors: errors.length,
    totalWarnings: warnings.length,
  };
};

/* =========================================================
   Main Pipeline
========================================================= */
const main = () => {
  const startTime = Date.now();
  blank();
  drawBox("MARGYN · ULTIMATE RELEASE PIPELINE", [
    "  🚀 Preparing workspace for production build...",
    "  🛡️  Validating TypeScript, committing, and building.",
  ]);
  blank();

  // 1. Clean
  runCmd("npm run clean", "🧹 Cleaning artifacts", true);
  blank();

  // 2. TypeScript Check
  process.stdout.write(
    `  ${C.cyan}⚡${C.reset} ${C.bold}Checking TypeScript errors (tsc)...${C.reset} `,
  );
  const tscResult = runCmd("npx tsc --noEmit", "", true);
  process.stdout.write("\r" + " ".repeat(80) + "\r");
  process.stdout.write(
    `  ${C.cyan}⚡${C.reset} ${C.bold}Checking TypeScript errors (tsc)...${C.reset} `,
  );

  const tscParsed = parseTscOutput(tscResult.output);
  if (!tscParsed.hasErrors) {
    console.log(
      `${C.green}${C.bold}✔ Project is flawless (0 Errors)${C.reset}`,
    );
  } else {
    console.log(
      `${C.red}${C.bold}✖ Found ${tscParsed.errors.length} TS Error(s)${C.reset}`,
    );
  }
  blank();

  // 3. Count Lines
  process.stdout.write(
    `  ${C.cyan}⚡${C.reset} ${C.bold}Counting source lines...${C.reset}\n\n`,
  );
  execSync("npm run count", { cwd: ROOT, stdio: "inherit" });
  blank();

  // 4. Git Add & Commit
  runCmd("git add .", "📦 Staging changes (git add)", true);
  const gitCommit = runCmd(
    'git commit -m "chore: prepare MARGYN project for release"',
    "📝 Committing changes (git commit)",
    true,
  );
  if (!gitCommit.success && !gitCommit.output.includes("nothing to commit")) {
    console.log(
      `  ${C.yellow}⚠ Note: Git commit skipped (No changes).${C.reset}`,
    );
  }
  blank();

  // 5. Build Process
  process.stdout.write(
    `  ${C.cyan}⚡${C.reset} ${C.bold}Building Electron App for Windows...${C.reset} ${C.dim}(This will take a few minutes)${C.reset}\n`,
  );
  process.stdout.write(
    `  ${C.dim}  Suppressing build logs to keep terminal clean...${C.reset}\n`,
  );
  blank();

  const buildResult = runCmd(
    "npm run electron:build:win",
    "Running electron-builder",
    true,
  );

  // 6. Summary & Diagnostics
  blank();
  drawBox("BUILD SUMMARY & DIAGNOSTICS", []);

  if (tscParsed.hasErrors) {
    log(`${C.red}${C.bold}✖ TypeScript Diagnostics:${C.reset}`);
    const errorCounts = {};
    tscParsed.errors.forEach(
      (e) => (errorCounts[e] = (errorCounts[e] || 0) + 1),
    );
    for (const [msg, count] of Object.entries(errorCounts)) {
      log(`    ${C.dim}└─${C.reset} ${C.red}${count}x${C.reset} ${msg}`);
    }
    blank();
  } else {
    log(
      `${C.green}${C.bold}✔ TypeScript: Project is flawless (0 Errors)${C.reset}`,
    );
    blank();
  }

  if (buildResult.success) {
    log(`${C.green}${C.bold}  🎉 Build Succeeded!${C.reset}`);

    const { totalWarnings, errorMap, warningMap } = parseBuildOutput(
      buildResult.output,
    );

    if (totalWarnings === 0) {
      log(`  ${C.green}✔ 0 Build Warnings. Perfectly clean build!${C.reset}`);
    } else {
      log(`  ${C.yellow}⚠ Found ${totalWarnings} Build Warning(s):${C.reset}`);
      for (const [msg, count] of Object.entries(warningMap)) {
        log(`    ${C.dim}└─${C.reset} ${C.yellow}${count}x${C.reset} ${msg}`);
      }
    }

    if (Object.keys(errorMap).length > 0) {
      log(`  ${C.red}✖ Found Non-Fatal Error(s):${C.reset}`);
      for (const [msg, count] of Object.entries(errorMap)) {
        log(`    ${C.dim}└─${C.reset} ${C.red}${count}x${C.reset} ${msg}`);
      }
    }
  } else {
    log(`${C.red}${C.bold}  ❌ Build Failed!${C.reset}`);
    log(
      `  ${C.red}The electron-builder process encountered a fatal error.${C.reset}`,
    );

    const { errorMap } = parseBuildOutput(buildResult.output);
    if (Object.keys(errorMap).length > 0) {
      log(`  ${C.red}Extracted Error Details:${C.reset}`);
      for (const [msg, count] of Object.entries(errorMap)) {
        log(`    ${C.dim}└─${C.reset} ${C.red}${count}x${C.reset} ${msg}`);
      }
    } else {
      log(
        `  ${C.dim}No specific error lines could be parsed. Check manually.${C.reset}`,
      );
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`${C.cyan}${C.bold}╠${"═".repeat(62)}╣${C.reset}`);
  log(
    `${C.cyan}${C.bold}║${C.reset} ${C.dim}Finished in ${duration}s${C.reset}${" ".repeat(62 - 14 - duration.length)}${C.cyan}${C.bold}║${C.reset}`,
  );
  log(`${C.cyan}${C.bold}╚${"═".repeat(62)}╝${C.reset}`);
  blank();
};

try {
  main();
} catch (err) {
  console.error(`\n${C.red}Script crashed unexpectedly:${C.reset}`, err);
  process.exit(1);
}