#!/usr/bin/env node
/**
 * Start the Next.js dev server under a local Nomad dev agent.
 * Nomad restarts the process automatically when it crashes.
 *
 * Requires Nomad CLI: https://developer.hashicorp.com/nomad/install
 *   winget install Hashicorp.Nomad
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JOB_FILE = path.join(ROOT, "nomad", "dev-server.nomad.hcl");
const NOMAD_DIR = path.join(ROOT, ".nomad");
const AGENT_DATA = path.join(NOMAD_DIR, "agent");
const AGENT_PID = path.join(NOMAD_DIR, "agent.pid");
const NOMAD_ADDR = process.env.NOMAD_ADDR ?? "http://127.0.0.1:4646";
const JOB_NAME = "badazz-tasks-dev";

function log(message) {
  console.log(`[dev-nomad] ${message}`);
}

function nomadEnv() {
  return { ...process.env, NOMAD_ADDR };
}

function run(bin, args = [], options = {}) {
  const result = spawnSync(bin, args, {
    cwd: ROOT,
    env: nomadEnv(),
    stdio: options.stdio ?? "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    const detail = result.stderr?.toString?.()?.trim();
    throw new Error(
      detail || `${bin} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`,
    );
  }
}

function runCapture(bin, args = []) {
  const result = spawnSync(bin, args, {
    cwd: ROOT,
    env: nomadEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${bin} ${args.join(" ")} failed`);
  }
  return (result.stdout ?? "").trim();
}

function nomadInstalled() {
  try {
    runCapture("nomad", ["version"]);
    return true;
  } catch {
    return false;
  }
}

function agentReachable() {
  try {
    runCapture("nomad", ["node", "status", "-self"]);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNomadPath(absPath) {
  return absPath.replace(/\\/g, "/");
}

function startAgent() {
  fs.mkdirSync(AGENT_DATA, { recursive: true });

  const child = spawn(
    "nomad",
    ["agent", "-dev", "-bind=127.0.0.1", `-data-dir=${AGENT_DATA}`],
    {
      cwd: ROOT,
      env: nomadEnv(),
      detached: true,
      stdio: "ignore",
      shell: false,
    },
  );

  child.unref();
  fs.writeFileSync(AGENT_PID, String(child.pid));
  log(`Started local Nomad dev agent (pid ${child.pid}, data: ${AGENT_DATA})`);
}

async function waitForAgent(maxMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (agentReachable()) return;
    await sleep(500);
  }
  throw new Error("Nomad agent did not become ready in time");
}

function clearDevPorts() {
  log("Clearing dev ports 3000/3001…");
  run(process.execPath, [path.join(ROOT, "scripts/dev-clean.mjs"), "--ports-only"], {
    stdio: "pipe",
  });
}

async function main() {
  if (!nomadInstalled()) {
    console.error(
      [
        "Nomad CLI not found.",
        "Install it, then re-run: npm run dev:nomad",
        "  winget install Hashicorp.Nomad",
        "  — or — https://developer.hashicorp.com/nomad/install",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (!fs.existsSync(JOB_FILE)) {
    console.error(`Missing job file: ${JOB_FILE}`);
    process.exit(1);
  }

  clearDevPorts();

  if (!agentReachable()) {
    log("No local Nomad agent detected — starting nomad agent -dev…");
    startAgent();
    await waitForAgent();
  } else {
    log("Using existing Nomad agent");
  }

  const projectRoot = toNomadPath(ROOT);
  const nodeBin = toNomadPath(process.execPath);

  log(`Submitting job "${JOB_NAME}"…`);
  run("nomad", [
    "job",
    "run",
    "-detach",
    `-var=project_root=${projectRoot}`,
    `-var=node_bin=${nodeBin}`,
    JOB_FILE,
  ]);

  let status = "";
  try {
    status = runCapture("nomad", ["job", "status", JOB_NAME]);
  } catch {
    // status may still be pending
  }

  log("Dev server is supervised by Nomad (auto-restart on crash).");
  log("Preview: http://localhost:3000");
  log("Logs:    npm run dev:nomad:logs");
  log("Stop:    npm run dev:nomad:stop");
  if (status) {
    console.log("");
    console.log(status);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
