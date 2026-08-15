"use strict";

const path = require("node:path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { createHost } = require("../src/session-host");

const host = createHost();
const extra = process.argv.slice(1);
const ICON = path.join(
  __dirname,
  "..",
  "assets",
  process.platform === "win32" ? "icon.ico" : "icon.png",
);

app.setName("Crush Setup");
if (process.platform === "win32") {
  app.setAppUserModelId("land.crush.setup");
}

if (extra.includes("--self-check")) {
  const fs = require("node:fs");
  const os = require("node:os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "crush-setup-e-"));
  try {
    const probe = host.persistProbe(tmp);
    const out = {
      ok: Boolean(probe.ok),
      app: "crush-setup",
      sections: host.meta().sections,
      persistProbe: probe.ok ? "ok" : "fail",
    };
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    app.exit(probe.ok ? 0 : 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
} else {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    let mainWindow = null;

    function focusMainWindow() {
      if (!mainWindow) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }

    function createWindow() {
      if (mainWindow) {
        focusMainWindow();
        return mainWindow;
      }
      const win = new BrowserWindow({
        width: 1280,
        height: 840,
        minWidth: 960,
        minHeight: 640,
        backgroundColor: "#1c1917",
        title: "Crush Setup",
        icon: ICON,
        frame: false,
        titleBarStyle: "hidden",
        webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      win.removeMenu();
      win.setIcon(ICON);
      win.loadFile(path.join(__dirname, "..", "ui", "index.html"));
      win.on("closed", () => {
        mainWindow = null;
      });
      mainWindow = win;
      return win;
    }

    app.on("second-instance", () => {
      focusMainWindow();
    });
    app.whenReady().then(createWindow);
    app.on("activate", () => {
      if (!mainWindow) createWindow();
      else focusMainWindow();
    });
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") app.quit();
    });
  }
}

ipcMain.handle("crush:meta", () => host.meta());
ipcMain.handle("crush:load", (_e, opts) => host.load(opts || {}));
ipcMain.handle("crush:save", () => host.save());
ipcMain.handle("crush:reload", () => host.reload());
ipcMain.handle("crush:apply", (_e, op, args) => host.apply(op, args));
ipcMain.handle("crush:state", () => host.state());
ipcMain.handle("crush:discover-models", (_e, opts) => host.discoverModels(opts || {}));
ipcMain.handle("crush:install-status", () => host.installStatus());
ipcMain.handle("crush:install", (_e, opts) => host.installCrush(opts || {}));
ipcMain.handle("crush:pick-directory", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win || undefined, { properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});
ipcMain.handle("win:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.handle("win:maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  return win.isMaximized();
});
ipcMain.handle("win:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});
ipcMain.handle("win:isMaximized", (event) => {
  return Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized());
});
