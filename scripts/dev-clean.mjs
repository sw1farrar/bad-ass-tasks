#!/usr/bin/env node
/**
 * Free dev ports and optionally remove a stale .next cache before starting dev.
 *
 * Usage:
 *   node scripts/dev-clean.mjs            # kill ports + remove .next
 *   node scripts/dev-clean.mjs --ports-only
 *   npm run dev:clean
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEV_PORTS = [3000, 3001];
const portsOnly = process.argv.includes("--ports-only");

function log(message) {
  console.log(`[dev-clean] ${message}`);
}

function killPort(port) {
  if (process.platform === "win32") {
    try {
      const output = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();

      const pids = [...new Set(output.split(/\s+/).filter((value) => /^\d+$/.test(value)))];
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          log(`Stopped process ${pid} on port ${port}`);
        } catch {
          // Process may have already exited.
        }
      }
      return;
    } catch {
      return;
    }
  }

  try {
    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, {
      stdio: "ignore",
      shell: true,
    });
    log(`Freed port ${port}`);
  } catch {
    // Nothing listening.
  }
}

function removeNextCache() {
  const nextDir = path.join(ROOT, ".next");
  if (!fs.existsSync(nextDir)) {
    log(".next cache not present");
    return;
  }

  fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  log("Removed .next cache");
}

for (const port of DEV_PORTS) {
  killPort(port);
}

if (portsOnly) {
  log("Ports cleared");
} else {
  removeNextCache();
  log("Ready for npm run dev");
}