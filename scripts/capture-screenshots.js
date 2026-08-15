"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { createHost } = require("../src/session-host");

const host = createHost();
const outDir = path.join(__dirname, "..", "docs", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

ipcMain.handle("crush:meta", () => host.meta());
ipcMain.handle("crush:load", (_e, opts) => host.load(opts || {}));
ipcMain.handle("crush:save", () => host.save());
ipcMain.handle("crush:reload", () => host.reload());
ipcMain.handle("crush:apply", (_e, op, args) => host.apply(op, args));
ipcMain.handle("crush:state", () => host.state());
ipcMain.handle("crush:discover-models", (_e, opts) => host.discoverModels(opts || {}));
ipcMain.handle("crush:pick-directory", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win || undefined, { properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});
ipcMain.handle("win:minimize", () => {});
ipcMain.handle("win:maximize", () => false);
ipcMain.handle("win:close", () => {});
ipcMain.handle("win:isMaximized", () => false);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    backgroundColor: "#1c1917",
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "..", "electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadFile(path.join(__dirname, "..", "ui", "index.html"));
  await new Promise((r) => setTimeout(r, 3200));

  async function shot(name, js) {
    if (js) await win.webContents.executeJavaScript(js);
    await new Promise((r) => setTimeout(r, 800));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, name), img.toPNG());
    process.stdout.write(`wrote ${name}\n`);
  }

  await shot("models.png");
  await shot(
    "models-provider.png",
    `(() => {
      var card = document.querySelector(".card");
      if (card) card.click();
      else { var add = document.getElementById("addBtn"); if (add) add.click(); }
    })()`,
  );
  await shot(
    "models-provider.png",
    `(() => {
      var el = document.getElementById("f-api_key");
      if (el) el.value = "$API_KEY";
    })()`,
  );
  await shot("skills.png", `document.querySelector('[data-section="skills"]').click()`);
  await shot("mcp.png", `document.querySelector('[data-section="mcp"]').click()`);
  await shot("options.png", `document.querySelector('[data-section="options"]').click()`);
  app.exit(0);
});
