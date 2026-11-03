/**
 * Runs the config integrity guard, then the real Next/ESLint/tsc binary.
 * Prefer `npm run dev` over `npx next dev` so this wrapper cannot be skipped.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGuard } from "./guard-js-configs.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const code = runGuard();
if (code !== 0) {
  process.exit(code);
}

const tool = process.argv[2];
const args = process.argv.slice(3);
if (!tool) {
  console.error("Usage: node scripts/run-guarded.mjs <next|eslint|tsc> [...args]");
  process.exit(2);
}

const binName = process.platform === "win32" ? `${tool}.cmd` : tool;
const bin = path.join(frontendRoot, "node_modules", ".bin", binName);

const child = spawn(bin, args, {
  cwd: frontendRoot,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (exitCode, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(exitCode ?? 1);
});
