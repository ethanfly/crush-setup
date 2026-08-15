"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const WINGET_ID = "charmbracelet.crush";
const NPM_PKG = "@charmland/crush";
const BREW_FORMULA = "charmbracelet/tap/crush";
const SCOOP_BUCKET = "https://github.com/charmbracelet/scoop-bucket.git";

const SPECS = {
  winget: {
    id: "winget",
    label: "winget",
    args: [
      "install",
      "--id",
      WINGET_ID,
      "-e",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity",
    ],
    upgradeArgs: [
      "upgrade",
      "--id",
      WINGET_ID,
      "-e",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity",
    ],
  },
  scoop: {
    id: "scoop",
    label: "Scoop",
    args: ["install", "crush"],
    upgradeArgs: ["update", "crush"],
    steps(file, upgrade) {
      return [
        {
          file,
          args: ["bucket", "add", "charm", SCOOP_BUCKET],
          optional: true,
        },
        { file, args: upgrade ? ["update", "crush"] : ["install", "crush"] },
      ];
    },
  },
  brew: {
    id: "brew",
    label: "Homebrew",
    args: ["install", BREW_FORMULA],
    upgradeArgs: ["upgrade", BREW_FORMULA],
  },
  npm: {
    id: "npm",
    label: "npm",
    args: ["install", "-g", NPM_PKG],
    upgradeArgs: ["install", "-g", NPM_PKG],
  },
};

const PRIORITY = {
  win32: ["winget", "scoop", "npm"],
  darwin: ["brew", "npm"],
  linux: ["brew", "npm"],
};

const INSTALLER_IDS = ["winget", "scoop", "brew", "npm"];
const DEFAULT_TIMEOUT_MS = 8 * 60 * 1000;
const VERSION_TIMEOUT_MS = 8000;
const MAX_LOG = 4000;

let inflight = null;

function defaults(opts = {}) {
  return {
    platform: opts.platform || process.platform,
    env: opts.env || process.env,
    fsMod: opts.fsMod || fs,
    pathMod: opts.pathMod || path,
    spawnFn: opts.spawnFn || spawn,
    timeoutMs: opts.timeoutMs || DEFAULT_TIMEOUT_MS,
  };
}

function isFile(filePath, fsMod) {
  try {
    return fsMod.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function extraDirsFor(name, env, platform, pathMod) {
  const home = env.HOME || env.USERPROFILE || "";
  const local = env.LOCALAPPDATA || (home ? pathMod.join(home, "AppData", "Local") : "");
  const roaming = env.APPDATA || (home ? pathMod.join(home, "AppData", "Roaming") : "");
  const dirs = [];
  if (name === "winget" && local) {
    dirs.push(pathMod.join(local, "Microsoft", "WindowsApps"));
  }
  if ((name === "scoop" || name === "crush") && home) {
    dirs.push(pathMod.join(home, "scoop", "shims"));
  }
  if (name === "brew") {
    dirs.push("/opt/homebrew/bin", "/usr/local/bin");
    if (home) dirs.push(pathMod.join(home, ".linuxbrew", "bin"));
  }
  if ((name === "npm" || name === "crush") && roaming) {
    dirs.push(pathMod.join(roaming, "npm"));
  }
  if (name === "crush") {
    if (home) dirs.push(pathMod.join(home, "go", "bin"));
    if (local) dirs.push(pathMod.join(local, "Microsoft", "WinGet", "Links"));
    dirs.push("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin");
  }
  return dirs.filter(Boolean);
}

function whichCommand(name, opts = {}) {
  const { platform, env, fsMod, pathMod } = defaults(opts);
  if (!name) return null;
  if (pathMod.isAbsolute(name) && isFile(name, fsMod)) return name;

  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") || "PATH";
  const pathDirs = String(env[pathKey] || "").split(pathMod.delimiter);
  const dirs = pathDirs.concat(extraDirsFor(name, env, platform, pathMod));
  const exts =
    platform === "win32"
      ? String(env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .map((e) => e.trim())
          .filter(Boolean)
      : [""];
  const hasExt = Boolean(pathMod.extname(name));

  for (const dir of dirs) {
    if (!dir) continue;
    const base = pathMod.join(dir, name);
    if (hasExt) {
      if (isFile(base, fsMod)) return base;
      continue;
    }
    if (platform === "win32") {
      for (const ext of exts) {
        const candidate = ext.startsWith(".") ? base + ext : `${base}.${ext}`;
        if (isFile(candidate, fsMod)) return candidate;
      }
    }
    if (isFile(base, fsMod)) return base;
  }
  return null;
}

function quoteCmd(value) {
  const str = String(value);
  if (!/[\s"]/.test(str)) return str;
  return `"${str.replace(/"/g, '\\"')}"`;
}

function clip(text) {
  const raw = String(text || "");
  if (raw.length <= MAX_LOG) return raw;
  return raw.slice(-MAX_LOG);
}

function runProcess(file, args, opts = {}) {
  const { env, spawnFn, platform } = defaults(opts);
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    let cmd = file;
    let argv = args.slice();
    const spawnOpts = {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    };
    if (platform === "win32" && /\.(cmd|bat)$/i.test(file)) {
      cmd = env.ComSpec || process.env.ComSpec || "cmd.exe";
      argv = ["/d", "/s", "/c", quoteCmd(file), ...args.map(quoteCmd)];
      spawnOpts.windowsVerbatimArguments = true;
    }

    let child;
    try {
      child = spawnFn(cmd, argv, spawnOpts);
    } catch (err) {
      resolve({
        ok: false,
        code: null,
        error: err.message || String(err),
        stdout: "",
        stderr: "",
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (stdout.length > 200000) stdout = stdout.slice(-120000);
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
        if (stderr.length > 200000) stderr = stderr.slice(-120000);
      });
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // already gone
      }
      finish({ ok: false, code: null, timedOut: true, stdout, stderr, error: "timed out" });
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      finish({
        ok: false,
        code: null,
        error: err.message || String(err),
        stdout,
        stderr,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function parseVersion(text) {
  if (text == null) return null;
  const raw = String(text).replace(/\u0000/g, "").trim();
  if (!raw) return null;
  const versionLine = raw.match(/version\s+v?(\d+\.\d+\.\d+\S*)/i);
  if (versionLine) return versionLine[1];
  const semver = raw.match(/\bv?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/);
  if (semver) return semver[1];
  return raw.split(/\r?\n/)[0].slice(0, 80) || null;
}

function detectAvailable(opts = {}) {
  const available = {};
  for (const id of INSTALLER_IDS) {
    const file = whichCommand(id, opts);
    if (file) available[id] = file;
  }
  return available;
}

function makePlan(id, file, upgrade) {
  const spec = SPECS[id];
  if (!spec || !file) return null;
  const args = upgrade && spec.upgradeArgs ? spec.upgradeArgs.slice() : spec.args.slice();
  const steps = spec.steps
    ? spec.steps(file, upgrade)
    : [{ file, args }];
  return {
    id,
    file,
    args,
    label: spec.label,
    steps,
  };
}

function pickInstaller(opts = {}) {
  const { platform } = defaults(opts);
  const available = opts.available || detectAvailable(opts);
  const order = PRIORITY[platform] || ["npm", "brew"];
  const upgrade = Boolean(opts.upgrade);
  const wanted = opts.method;
  if (wanted) {
    if (!SPECS[wanted]) return null;
    if (!available[wanted]) return null;
    return makePlan(wanted, available[wanted], upgrade);
  }
  for (const id of order) {
    if (available[id]) return makePlan(id, available[id], upgrade);
  }
  return null;
}

async function readCrushVersion(file, opts = {}) {
  const first = await runProcess(file, ["--version"], {
    ...opts,
    timeoutMs: VERSION_TIMEOUT_MS,
  });
  let version = parseVersion(first.stdout || first.stderr);
  if (version) return version;
  const again = await runProcess(file, ["-v"], {
    ...opts,
    timeoutMs: VERSION_TIMEOUT_MS,
  });
  return parseVersion(again.stdout || again.stderr);
}

async function resolveCrush(opts = {}) {
  const file = whichCommand("crush", opts);
  if (!file) return { installed: false, path: null, version: null };
  const version = await readCrushVersion(file, opts);
  return { installed: true, path: file, version };
}

function installerList(available, platform) {
  const order = PRIORITY[platform] || ["npm", "brew"];
  const ids = [...new Set(order.concat(INSTALLER_IDS))];
  return ids.map((id) => ({
    id,
    label: SPECS[id].label,
    available: Boolean(available[id]),
    path: available[id] || null,
  }));
}

async function getStatus(opts = {}) {
  const cfg = defaults(opts);
  const available = detectAvailable(cfg);
  const crush = await resolveCrush(cfg);
  const preferred = pickInstaller({ ...cfg, available, upgrade: crush.installed });
  return {
    installed: crush.installed,
    path: crush.path,
    version: crush.version,
    preferred: preferred ? preferred.id : null,
    preferredLabel: preferred ? preferred.label : null,
    installers: installerList(available, cfg.platform),
    installing: Boolean(inflight),
  };
}

function looksAlreadyDone(text) {
  return /already installed|already up[- ]to[- ]date|no applicable update|no available upgrade|is the latest version/i.test(
    text || "",
  );
}

function summarizeLogs(results) {
  const stdout = results.map((r) => r.stdout || "").filter(Boolean).join("\n");
  const stderr = results.map((r) => r.stderr || "").filter(Boolean).join("\n");
  return { stdout: clip(stdout), stderr: clip(stderr) };
}

async function runInstall(opts = {}) {
  const cfg = defaults(opts);
  const available = detectAvailable(cfg);
  const before = await resolveCrush(cfg);
  const plan = pickInstaller({
    ...cfg,
    available,
    upgrade: before.installed,
    method: opts.method,
  });
  if (!plan) {
    return {
      ok: false,
      installed: before.installed,
      path: before.path,
      version: before.version,
      method: opts.method || null,
      error: opts.method ? `installer not available: ${opts.method}` : "no installer found",
      installers: installerList(available, cfg.platform),
    };
  }

  const results = [];
  for (const step of plan.steps) {
    const result = await runProcess(step.file, step.args, cfg);
    results.push(result);
    if (!result.ok && !step.optional && !looksAlreadyDone(`${result.stdout}\n${result.stderr}`)) {
      const afterFail = await resolveCrush(cfg);
      const logs = summarizeLogs(results);
      if (afterFail.installed) {
        return {
          ok: true,
          installed: true,
          path: afterFail.path,
          version: afterFail.version,
          method: plan.id,
          pendingPath: false,
          command: [step.file, ...step.args],
          ...logs,
        };
      }
      return {
        ok: false,
        installed: afterFail.installed,
        path: afterFail.path,
        version: afterFail.version,
        method: plan.id,
        error: result.timedOut ? "install timed out" : result.error || `installer exited ${result.code}`,
        timedOut: Boolean(result.timedOut),
        command: [step.file, ...step.args],
        ...logs,
      };
    }
  }

  const after = await resolveCrush(cfg);
  const logs = summarizeLogs(results);
  if (after.installed) {
    return {
      ok: true,
      installed: true,
      path: after.path,
      version: after.version,
      method: plan.id,
      pendingPath: false,
      command: [plan.file, ...plan.args],
      ...logs,
    };
  }

  const last = results[results.length - 1] || {};
  const combined = `${logs.stdout}\n${logs.stderr}`;
  if (last.ok || looksAlreadyDone(combined)) {
    return {
      ok: true,
      installed: false,
      pendingPath: true,
      path: null,
      version: null,
      method: plan.id,
      command: [plan.file, ...plan.args],
      ...logs,
    };
  }
  return {
    ok: false,
    installed: false,
    path: null,
    version: null,
    method: plan.id,
    error: last.error || "Crush was not found after install",
    command: [plan.file, ...plan.args],
    ...logs,
  };
}

async function installCrush(opts = {}) {
  if (inflight) {
    const status = await getStatus(opts);
    return {
      ok: false,
      busy: true,
      error: "install already running",
      ...status,
    };
  }
  inflight = runInstall(opts);
  try {
    const result = await inflight;
    const status = await getStatus(opts);
    return { ...status, ...result, installing: false };
  } finally {
    inflight = null;
  }
}

function _resetForTests() {
  inflight = null;
}

module.exports = {
  SPECS,
  PRIORITY,
  WINGET_ID,
  NPM_PKG,
  BREW_FORMULA,
  parseVersion,
  whichCommand,
  extraDirsFor,
  detectAvailable,
  pickInstaller,
  resolveCrush,
  getStatus,
  installCrush,
  runProcess,
  _resetForTests,
};
