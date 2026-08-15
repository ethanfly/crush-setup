"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  parseVersion,
  whichCommand,
  pickInstaller,
  extraDirsFor,
  WINGET_ID,
  NPM_PKG,
  BREW_FORMULA,
  _resetForTests,
} = require("../src/install");

describe("crush install helpers", () => {
  const temps = [];

  afterEach(() => {
    _resetForTests();
    while (temps.length) {
      fs.rmSync(temps.pop(), { recursive: true, force: true });
    }
  });

  function sandbox() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "crush-setup-install-"));
    temps.push(root);
    return root;
  }

  it("parses crush --version output", () => {
    assert.equal(parseVersion("Crush version 0.13.2"), "0.13.2");
    assert.equal(parseVersion("crush version v0.1.0-dev"), "0.1.0-dev");
    assert.equal(parseVersion("0.8.4\n"), "0.8.4");
    assert.equal(parseVersion(""), null);
    assert.equal(parseVersion(null), null);
  });

  it("whichCommand finds PATHEXT matches on a fake Windows PATH", () => {
    const root = sandbox();
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, "winget.exe"), "x");
    const found = whichCommand("winget", {
      platform: "win32",
      env: { PATH: bin, PATHEXT: ".EXE;.CMD" },
      fsMod: fs,
      pathMod: path,
    });
    assert.ok(found);
    assert.equal(path.basename(found).toLowerCase(), "winget.exe");

    const sensitive = {
      statSync(filePath) {
        const dir = path.dirname(filePath);
        const base = path.basename(filePath);
        const names = fs.readdirSync(dir);
        if (!names.includes(base)) {
          const err = new Error(`ENOENT: ${filePath}`);
          err.code = "ENOENT";
          throw err;
        }
        return fs.statSync(filePath);
      },
    };
    const ciFound = whichCommand("winget", {
      platform: "win32",
      env: { PATH: bin, PATHEXT: ".EXE;.CMD" },
      fsMod: sensitive,
      pathMod: path,
    });
    assert.ok(ciFound, "win32 PATHEXT match must work on a case-sensitive FS");
    assert.equal(path.basename(ciFound), "winget.exe");
  });

  it("whichCommand checks extra dirs for crush", () => {
    const root = sandbox();
    const home = path.join(root, "home");
    const shims = path.join(home, "scoop", "shims");
    fs.mkdirSync(shims, { recursive: true });
    fs.writeFileSync(path.join(shims, "crush.exe"), "x");
    const found = whichCommand("crush", {
      platform: "win32",
      env: { PATH: "", HOME: home, USERPROFILE: home, PATHEXT: ".EXE" },
      fsMod: fs,
      pathMod: path,
    });
    assert.ok(found);
    assert.ok(found.toLowerCase().endsWith("crush.exe"));
  });

  it("prefers winget on Windows and includes non-interactive flags", () => {
    const plan = pickInstaller({
      platform: "win32",
      available: {
        winget: path.join("C:", "winget.exe"),
        npm: path.join("C:", "npm.cmd"),
      },
    });
    assert.equal(plan.id, "winget");
    assert.ok(plan.args.includes("--id"));
    assert.ok(plan.args.includes(WINGET_ID));
    assert.ok(plan.args.includes("--accept-package-agreements"));
    assert.ok(plan.args.includes("--disable-interactivity"));
  });

  it("uses winget upgrade args when Crush is already present", () => {
    const plan = pickInstaller({
      platform: "win32",
      available: { winget: "winget.exe" },
      upgrade: true,
    });
    assert.equal(plan.args[0], "upgrade");
  });

  it("prefers Homebrew on macOS", () => {
    const plan = pickInstaller({
      platform: "darwin",
      available: { brew: "/opt/homebrew/bin/brew", npm: "/usr/local/bin/npm" },
    });
    assert.equal(plan.id, "brew");
    assert.ok(plan.args.includes(BREW_FORMULA));
  });

  it("falls back to npm and never interpolates a shell", () => {
    const plan = pickInstaller({
      platform: "linux",
      available: { npm: "/usr/bin/npm" },
    });
    assert.equal(plan.id, "npm");
    assert.deepEqual(plan.args, ["install", "-g", NPM_PKG]);
  });

  it("returns null when no installer is available", () => {
    assert.equal(pickInstaller({ platform: "win32", available: {} }), null);
    assert.equal(pickInstaller({ platform: "win32", available: { npm: "npm" }, method: "winget" }), null);
    assert.equal(pickInstaller({ platform: "linux", available: { npm: "npm" }, method: "nope" }), null);
  });

  it("lists well-known extra dirs without requiring them to exist", () => {
    const dirs = extraDirsFor(
      "crush",
      { USERPROFILE: "C:\\Users\\me", LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" },
      "win32",
      path,
    );
    assert.ok(dirs.some((d) => /scoop/i.test(d)));
    assert.ok(dirs.some((d) => /WinGet/i.test(d)));
  });
});
