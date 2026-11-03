/**
 * Copies guard hooks into .git/hooks. Does not change git config.
 * No-ops when .git is missing (Docker npm ci).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hookNames = ["pre-commit", "post-merge", "post-checkout"];

function gitRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: frontendRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function hooksDir(root) {
  const gitPath = path.join(root, ".git");
  if (!fs.existsSync(gitPath)) return null;
  const stat = fs.statSync(gitPath);
  if (stat.isDirectory()) {
    return path.join(gitPath, "hooks");
  }
  const text = fs.readFileSync(gitPath, "utf8");
  const match = text.match(/^gitdir:\s*(.+)$/m);
  if (!match) return null;
  const gitDir = path.resolve(root, match[1].trim());
  return path.join(gitDir, "hooks");
}

const root = gitRoot();
if (!root) {
  process.exit(0);
}

const destDir = hooksDir(root);
if (!destDir) {
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
const srcDir = path.join(frontendRoot, "scripts", "githooks");
for (const name of hookNames) {
  const src = path.join(srcDir, name);
  const dest = path.join(destDir, name);
  fs.copyFileSync(src, dest);
  try {
    fs.chmodSync(dest, 0o755);
  } catch {
    // Windows may ignore chmod; Git Bash still runs the hook.
  }
}
