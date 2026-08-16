"use strict";

// Renders assets/icon.svg to PNGs (app icon + UI mark) and assets/icon.ico.
// Run manually: npx electron scripts/render-icon.js

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "assets", "icon.svg");

function icoFromPngs(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dirSize = 6 + entries.length * 16;
  let offset = dirSize;
  const dir = Buffer.alloc(dirSize);
  header.copy(dir, 0);
  const chunks = [];
  entries.forEach((entry, i) => {
    const size = entry.size >= 256 ? 0 : entry.size;
    const base = 6 + i * 16;
    dir.writeUInt8(size, base);
    dir.writeUInt8(size, base + 1);
    dir.writeUInt8(0, base + 2);
    dir.writeUInt8(0, base + 3);
    dir.writeUInt16LE(1, base + 4);
    dir.writeUInt16LE(32, base + 6);
    dir.writeUInt32LE(entry.png.length, base + 8);
    dir.writeUInt32LE(offset, base + 12);
    offset += entry.png.length;
    chunks.push(entry.png);
  });
  return Buffer.concat([dir, ...chunks]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 800,
    show: false,
    webPreferences: { offscreen: true },
  });
  const svg = fs.readFileSync(svgPath, "utf8");
  await win.loadURL(
    "data:text/html," +
      encodeURIComponent(
        '<!DOCTYPE html><html><body style="margin:0">' + svg.replace('viewBox', 'width="800" height="800" viewBox') + "</body></html>",
      ),
  );
  await new Promise((r) => setTimeout(r, 600));

  async function renderPng(size) {
    const dataUrl = await win.webContents.executeJavaScript(`(async () => {
      const img = new Image();
      img.src = "data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}";
      await img.decode();
      const c = document.createElement("canvas");
      c.width = ${size}; c.height = ${size};
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, ${size}, ${size});
      return c.toDataURL("image/png");
    })()`);
    return Buffer.from(dataUrl.split(",")[1], "base64");
  }

  const png1024 = await renderPng(1024);
  const png256 = await renderPng(256);
  const png48 = await renderPng(48);
  const png32 = await renderPng(32);
  const png16 = await renderPng(16);

  fs.writeFileSync(path.join(root, "assets", "icon.png"), png1024);
  fs.writeFileSync(path.join(root, "ui", "icon.png"), png256);
  fs.writeFileSync(
    path.join(root, "assets", "icon.ico"),
    icoFromPngs([
      { size: 256, png: png256 },
      { size: 48, png: png48 },
      { size: 32, png: png32 },
      { size: 16, png: png16 },
    ]),
  );
  process.stdout.write("icons rendered\n");
  app.exit(0);
});
