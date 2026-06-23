#!/usr/bin/env node
/**
 * Stop the Nomad-supervised dev server (and local dev agent if we started it).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NOMAD_DIR = path.join(ROOT, ".nomad");
const AGENT_PID = path.join(NOMAD_DIR, "agent.pid");
const NOMAD_ADDR = process.env.NOMAD_ADDR ?? "http://127.0.0.1:4646";
const JOB_NAME = "badazz-tasks-dev";

function log(message) {
  console.log(`[dev-nomad] ${message}`);
}

function nomadEnv() {
  return { ...process.env, NOMAD_ADDR };
}

function tryNomad(args) {
  const result = spawnSync("nomad", args, {
    cwd: ROOT,
    env: nomadEnv(),
    stdio: "inherit",
    shell: false,
  });
  return result.status === 0;
}

function main() {
  if (tryNomad(["job", "stop", "-purge", JOB_NAME])) {
    log(`Stopped job "${JOB_NAME}"`);
  } else {
    log(`Job "${JOB_NAME}" was not running (or Nomad is unavailable)`);
  }

  if (fs.existsSync(AGENT_PID)) {
    const pid = Number(fs.readFileSync(AGENT_PID, "utf8").trim());
    if (Number.isFinite(pid) && pid > 0) {
      try {
        process.kill(pid);
        log(`Stopped local Nomad dev agent (pid ${pid})`);
      } catch {
        log("Local Nomad dev agent already stopped");
      }
    }
    fs.rmSync(AGENT_PID, { force: true });
  }

  spawnSync(process.execPath, [path.join(ROOT, "scripts/dev-clean.mjs"), "--ports-only"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });
}

main();
