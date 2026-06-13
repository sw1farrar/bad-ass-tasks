#!/usr/bin/env node
/**
 * Start the Turbopack dev server with stable defaults for this repo.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

/** Turbopack cannot reuse a .next cache produced by webpack (RSC binding mismatch). */
function removeStaleWebpackNextCache() {
  const nextDir = path.join(ROOT, ".next");
  const webpackRuntime = path.join(nextDir, "server", "webpack-runtime.js");
  if (!fs.existsSync(webpackRuntime)) return;

  fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  console.log("[dev-start] Removed stale webpack .next cache before Turbopack");
}

removeStaleWebpackNextCache();

const child = spawn(
  process.execPath,
  ["--max-old-space-size=4096", nextBin, "dev", "--turbopack"],
  {
    cwd: ROOT,
    env: {
      ...process.env,
      BADAZZ_DEV_BUNDLER: "turbopack",
    },
    stdio: "inherit",
    shell: false,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});