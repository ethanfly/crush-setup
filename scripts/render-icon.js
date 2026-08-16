"use strict";

// Pixel-art icon from the same purple → pink → gold ramp as assets/icon-source.jpg.
// Run: npx electron scripts/render-icon.js

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.join(__dirname, "..");
const GRID = 32;

const C0 = [0x7c, 0x63, 0xc2];
const C1 = [0xf0, 0xa8, 0xcc];
const C2 = [0xf3, 0xdc, 0x7a];
const STEPS = 7;
const BAYER = [
  [0, 2],
  [3, 1],
];

function lerp(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function toHex(rgb) {
  return (
    "#" +
    rgb
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function ramp(t) {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.52) return lerp(C0, C1, x / 0.52);
  return lerp(C1, C2, (x - 0.52) / 0.48);
}

function inSquircle(x, y, n) {
  const cut = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [0, 2],
  ];
  const corners = [
    [x, y],
    [n - 1 - x, y],
    [x, n - 1 - y],
    [n - 1 - x, n - 1 - y],
  ];
  for (const [cx, cy] of corners) {
    for (const [dx, dy] of cut) {
      if (cx === dx && cy === dy) return false;
    }
  }
  return true;
}

function pixelAt(x, y, n) {
  if (!inSquircle(x, y, n)) return null;
  const t = (x + y) / (2 * (n - 1));
  const scaled = t * STEPS;
  let stepped = Math.max(0, Math.min(STEPS - 1, Math.floor(scaled)));
  const frac = scaled - stepped;
  if (frac > 0.42 && frac < 0.58 && BAYER[y % 2][x % 2] >= 2 && stepped < STEPS - 1) {
    stepped += 1;
  }
  return ramp((stepped + 0.5) / STEPS);
}

function buildGrid(n) {
  const grid = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) row.push(pixelAt(x, y, n));
    grid.push(row);
  }
  return grid;
}

function svgFromGrid(grid) {
  const n = grid.length;
  const cell = 8;
  const size = n * cell;
  const runs = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      const color = grid[y][x];
      if (!color) {
        x += 1;
        continue;
      }
      const hex = toHex(color);
      let w = 1;
      while (x + w < n && grid[y][x + w] && toHex(grid[y][x + w]) === hex) w += 1;
      runs.push(
        `<rect x="${x * cell}" y="${y * cell}" width="${w * cell}" height="${cell}" fill="${hex}"/>`,
      );
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
${runs.join("\n")}
</svg>
`;
}

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
  const grid = buildGrid(GRID);
  const svg = svgFromGrid(grid);
  fs.writeFileSync(path.join(root, "assets", "icon.svg"), svg);

  const win = new BrowserWindow({
    width: 64,
    height: 64,
    show: false,
    webPreferences: { offscreen: true },
  });
  await win.loadURL("data:text/html,<html><body></body></html>");

  const cells = JSON.stringify(grid.map((row) => row.map((c) => (c ? toHex(c) : null))));

  async function renderPng(size) {
    const dataUrl = await win.webContents.executeJavaScript(`(() => {
      const grid = ${cells};
      const n = grid.length;
      const c = document.createElement("canvas");
      c.width = ${size};
      c.height = ${size};
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      const src = document.createElement("canvas");
      src.width = n;
      src.height = n;
      const sctx = src.getContext("2d");
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const hex = grid[y][x];
          if (!hex) continue;
          sctx.fillStyle = hex;
          sctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.drawImage(src, 0, 0, ${size}, ${size});
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
