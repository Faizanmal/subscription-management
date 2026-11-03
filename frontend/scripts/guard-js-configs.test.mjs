import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { collectIssues, inspectBuffer, runGuard } from "./guard-js-configs.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "swm-guard-"));
  const frontend = path.join(root, "frontend");
  fs.mkdirSync(frontend);
  return { root, frontend };
}

test("current frontend configs pass", () => {
  const issues = collectIssues(frontendRoot, path.resolve(frontendRoot, ".."));
  assert.deepEqual(issues, []);
  assert.equal(runGuard(frontendRoot, path.resolve(frontendRoot, "..")), 0);
});

test("clean postcss allowlist matches the repo file", () => {
  const buf = fs.readFileSync(path.join(frontendRoot, "postcss.config.mjs"));
  assert.deepEqual(inspectBuffer("postcss.config.mjs", buf), []);
});

test("createRequire shim in postcss is blocked", () => {
  const payload = Buffer.from(
    "import { createRequire } from 'module';\n\nconst require = createRequire(import.meta.url);\n\nconst config = {\n  plugins: {\n    \"@tailwindcss/postcss\": {},\n  },\n};\n\nexport default config;\n",
  );
  const issues = inspectBuffer("postcss.config.mjs", payload);
  assert.ok(issues.some((item) => item.includes("createRequire-shim")));
  assert.ok(issues.some((item) => item.includes("do not match the allowed")));
});

test("hidden long-line payload is blocked", () => {
  const line = `export default config; ${"x".repeat(5000)}`;
  const issues = inspectBuffer("postcss.config.mjs", Buffer.from(`const config = { plugins: {} };\n${line}\n`));
  assert.ok(issues.some((item) => item.includes("line is")));
});

test("postcss.config.js is blocked even if small", () => {
  const issues = inspectBuffer(
    "postcss.config.js",
    Buffer.from("module.exports = { plugins: {} };\n"),
  );
  assert.ok(issues.some((item) => item.includes("executable PostCSS config")));
});

test("eval and child_process signatures are blocked in next.config", () => {
  const issues = inspectBuffer(
    "next.config.ts",
    Buffer.from('import { spawn } from "child_process";\neval("1");\nspawn("node");\nexport default {};\n'),
  );
  assert.ok(issues.some((item) => item.includes("child-process")));
  assert.ok(issues.some((item) => item.includes("eval-call")));
  assert.ok(issues.some((item) => item.includes("detached-spawn")));
});

test("collectIssues finds a dropper filename at repo root", () => {
  const { root, frontend } = makeTree();
  fs.writeFileSync(
    path.join(frontend, "postcss.config.mjs"),
    'const config = {\n  plugins: {\n    "@tailwindcss/postcss": {},\n  },\n};\n\nexport default config;\n',
  );
  fs.writeFileSync(path.join(root, "temp_auto_push.bat"), "echo no\n");
  const issues = collectIssues(frontend, root);
  assert.ok(issues.some((item) => item.includes("temp_auto_push.bat")));
  fs.rmSync(root, { recursive: true, force: true });
});
