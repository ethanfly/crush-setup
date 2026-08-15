#!/usr/bin/env node
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");

const root = path.join(__dirname, "..");

function printHelp() {
  console.log(`Crush Setup — desktop manager for Crush config

Usage:
  crush-setup                     Launch the desktop window
  crush-setup --self-check        Print sections + persist probe (no GUI)
  crush-setup --serve [port]      Serve the UI over http://127.0.0.1
  crush-setup --persist-probe <dir>
                                  Two-process persist consumer (write then read)

Sections: models, skills, mcp, lsp, hooks, permissions, options, env
`);
}

async function selfCheck() {
  const { createHost } = require("../src/session-host");
  const host = createHost();
  const meta = host.meta();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "crush-setup-self-"));
  let probe;
  try {
    probe = host.persistProbe(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const out = {
    ok: Boolean(probe.ok),
    app: "crush-setup",
    sections: meta.sections,
    persistProbe: probe.ok ? "ok" : "fail",
    writePath: probe.writePath,
  };
  console.log(JSON.stringify(out, null, 2));
  if (!probe.ok || !meta.sections.includes("models") || !meta.sections.includes("skills") || !meta.sections.includes("mcp")) {
    process.exitCode = 1;
  }
}

async function serve(portArg) {
  const { listen } = require("../src/server");
  const port = portArg ? Number(portArg) : 0;
  const { url } = await listen(port);
  console.log(`Crush Setup UI at ${url}`);
  return url;
}

function persistProbe(dir) {
  const probe = path.join(root, "test", "persist-probe.js");
  const write = spawn(process.execPath, [probe, "write", dir], { stdio: "inherit" });
  write.on("exit", (code) => {
    if (code !== 0) process.exit(code || 1);
    const read = spawn(process.execPath, [probe, "read", dir], { stdio: "inherit" });
    read.on("exit", (c) => process.exit(c || 0));
  });
}

function launchElectron() {
  let electron;
  try {
    electron = require("electron");
  } catch {
    return null;
  }
  const child = spawn(electron, [root, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code == null ? 0 : code));
  return child;
}

function edgeAppExe() {
  if (process.platform !== "win32") return null;
  const candidates = [
    path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function openDesktopWindow(url) {
  const edge = edgeAppExe();
  if (edge) {
    spawn(edge, [`--app=${url}`, "--window-size=1280,840"], { stdio: "ignore", detached: true }).unref();
    return "edge-app";
  }
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
    return "browser";
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    return;
  }
  if (args.includes("--self-check")) {
    await selfCheck();
    return;
  }
  if (args[0] === "--persist-probe") {
    if (!args[1]) {
      console.error("crush-setup --persist-probe <dir>");
      process.exit(2);
    }
    persistProbe(path.resolve(args[1]));
    return;
  }
  if (args[0] === "--serve") {
    await serve(args[1]);
    return;
  }

  const launched = launchElectron();
  if (launched) return;

  const url = await serve(0);
  const how = openDesktopWindow(url);
  if (how === "edge-app") {
    console.log(`Crush Setup window (Edge app mode) ${url}`);
  } else {
    console.log(`Crush Setup UI at ${url}`);
    console.log("Optional native window: npm install --save-dev electron && npm start");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
