#!/usr/bin/env node
/**
 * Start the Next.js dev server with stable defaults for this repo.
 * Uses webpack on Windows when dependencies are installed via pnpm junctions.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

function usesPnpmStoreLayout() {
  return fs.existsSync(path.join(ROOT, "node_modules", ".pnpm"));
}

function resolveBundlerPreference() {
  const override = process.env.BADAZZ_DEV_BUNDLER?.trim().toLowerCase();
  if (override === "webpack") return "webpack";
  if (override === "turbopack") return "turbopack";

  // Turbopack can fail to resolve `next/package.json` through pnpm junctions on Windows.
  if (process.platform === "win32" && usesPnpmStoreLayout()) {
    return "webpack";
  }

  return "turbopack";
}

/** Turbopack cannot reuse a .next cache produced by webpack (RSC binding mismatch). */
function removeStaleDevCache(bundler) {
  const nextDir = path.join(ROOT, ".next");
  if (!fs.existsSync(nextDir)) return;

  const webpackRuntime = path.join(nextDir, "server", "webpack-runtime.js");
  const shouldClear =
    fs.existsSync(webpackRuntime) ||
    (bundler === "turbopack" && usesPnpmStoreLayout());

  if (!shouldClear) return;

  fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  console.log("[dev-start] Cleared stale .next cache before dev server start");
}

const bundler = resolveBundlerPreference();
const useTurbopack = bundler === "turbopack";

removeStaleDevCache(bundler);

if (!useTurbopack && !process.env.BADAZZ_DEV_BUNDLER) {
  console.log(
    "[dev-start] Using webpack dev (pnpm node_modules layout on Windows; set BADAZZ_DEV_BUNDLER=turbopack to force Turbopack)",
  );
}

const devArgs = ["--max-old-space-size=4096", nextBin, "dev"];
if (useTurbopack) {
  devArgs.push("--turbopack");
}

const child = spawn(process.execPath, devArgs, {
  cwd: ROOT,
  env: {
    ...process.env,
    BADAZZ_DEV_BUNDLER: bundler,
  },
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});