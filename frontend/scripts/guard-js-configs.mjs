/**
 * Blocks Node/Next from starting when pull/merge brings back a
 * config-file dropper (PostCSS/Next/ESLint/etc.).
 *
 * npm run dev/build/start call this first. It never executes scanned files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const FRONTEND_ROOT = path.resolve(path.dirname(__filename), "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  ".git",
  "coverage",
]);

const CONFIG_NAME =
  /^(postcss|next|tailwind|eslint|vite|webpack|babel|prettier|vue|astro|svelte|nuxt|remix|vitest|jest)\.config\.(js|mjs|cjs|ts|cts|mts)$/i;

const EXECUTABLE_POSTCSS = /^(postcss\.config\.(js|cjs|ts|cts|mts)|\.postcssrc\.(js|mjs|cjs|ts))$/i;

const DROPPER_FILES = [
  "temp_auto_push.bat",
  "temp_interactive_push.bat",
  "config.bat",
];

const MAX_BYTES = {
  "postcss.config.mjs": 512,
  "postcss.config.json": 1024,
  "next.config.ts": 16_384,
  "next.config.js": 16_384,
  "next.config.mjs": 16_384,
  "eslint.config.mjs": 16_384,
  default: 32_768,
};

const MAX_LINE_CHARS = 400;

const SIGNATURES = [
  { id: "createRequire-shim", re: /createRequire\s*\(/ },
  { id: "child-process", re: /child_process|child_proc/i },
  { id: "eval-call", re: /\beval\s*\(/ },
  { id: "dynamic-function", re: /new\s+Function\s*\(|\bFunction\s*\(/ },
  { id: "detached-spawn", re: /\bspawn\s*\(/ },
  { id: "obfuscated-hex-id", re: /_0x[a-fA-F0-9]{4,}/ },
  { id: "global-i-marker", re: /global\.i\s*=/ },
  { id: "ether-hiding-rpc", re: /eth_getTransaction|eth_blockNumber|trongrid|blockscout|1rpc\.io|drpc\.org/i },
];

const POSTCSS_MJS_ALLOW = /^[\s]*const config = \{\s*plugins:\s*\{\s*"@tailwindcss\/postcss":\s*\{\s*\}\s*,?\s*\}\s*,?\s*\}\s*;\s*export default config;\s*$/;

function maxBytesFor(name) {
  return MAX_BYTES[name] ?? MAX_BYTES.default;
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") && entry.name !== ".vscode") continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
}

function rel(from, file) {
  return path.relative(from, file).split(path.sep).join("/");
}

export function inspectBuffer(fileRel, buffer) {
  const issues = [];
  const base = path.posix.basename(fileRel.replace(/\\/g, "/"));
  const text = buffer.toString("utf8");
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (EXECUTABLE_POSTCSS.test(base)) {
    issues.push(
      `${fileRel}: executable PostCSS config is not allowed (Next would load it). Keep only postcss.config.mjs or postcss.config.json.`,
    );
  }

  const limit = maxBytesFor(base);
  if (buffer.length > limit) {
    issues.push(`${fileRel}: ${buffer.length} bytes exceeds ${limit} byte limit for this config`);
  }

  const lines = normalized.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].length > MAX_LINE_CHARS) {
      issues.push(
        `${fileRel}:${i + 1}: line is ${lines[i].length} chars (max ${MAX_LINE_CHARS}); hidden payloads are often padded onto one line`,
      );
      break;
    }
  }

  if (base === "postcss.config.mjs" && !POSTCSS_MJS_ALLOW.test(normalized)) {
    issues.push(
      `${fileRel}: contents do not match the allowed Tailwind PostCSS config (extra imports/code are blocked)`,
    );
  }

  if (/\.(js|mjs|cjs|ts|cts|mts)$/i.test(base) || base === "tasks.json") {
    for (const sig of SIGNATURES) {
      if (sig.re.test(normalized)) {
        issues.push(`${fileRel}: blocked signature "${sig.id}"`);
      }
    }
  }

  if (base === "tasks.json" && /runOn["'\s:]*folderOpen/i.test(normalized)) {
    issues.push(`${fileRel}: VS Code/Cursor folderOpen task is blocked (common dropper)`);
  }

  return issues;
}

export function collectIssues(frontendRoot = FRONTEND_ROOT, repoRoot = REPO_ROOT) {
  const issues = [];
  const files = [];
  walk(frontendRoot, files);

  const vscodeDir = path.join(repoRoot, ".vscode");
  if (fs.existsSync(vscodeDir)) {
    walk(vscodeDir, files);
  }

  for (const dropper of DROPPER_FILES) {
    const found = path.join(repoRoot, dropper);
    if (fs.existsSync(found)) {
      issues.push(`${rel(repoRoot, found)}: known dropper filename is present; delete it and do not run it`);
    }
  }

  for (const file of files) {
    const name = path.basename(file);
    const fileRel = file.startsWith(frontendRoot)
      ? rel(frontendRoot, file)
      : rel(repoRoot, file);
    const isConfig = CONFIG_NAME.test(name) || EXECUTABLE_POSTCSS.test(name) || name === "tasks.json";
    if (!isConfig) continue;
    let buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch {
      continue;
    }
    issues.push(...inspectBuffer(fileRel, buffer));
  }

  return issues;
}

export function runGuard(frontendRoot = FRONTEND_ROOT, repoRoot = REPO_ROOT) {
  const issues = collectIssues(frontendRoot, repoRoot);
  if (issues.length === 0) {
    return 0;
  }
  console.error("Config integrity check failed. npm/next was not started.\n");
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  console.error(
    "\nIf this appeared after git pull/merge, do not run next/node on the infected file. Restore the clean config and stop.",
  );
  return 1;
}

function isMain() {
  const invoked = process.argv[1] && path.resolve(process.argv[1]);
  return invoked === __filename;
}

if (isMain()) {
  process.exit(runGuard());
}
