"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

function latestTag() {
  try {
    return execSync("git describe --tags --abbrev=0", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function bump(version) {
  const parts = String(version || "0.0.0").replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

const fromEnv = process.env.RELEASE_VERSION || process.env.VERSION;
let next;
if (fromEnv) {
  next = String(fromEnv).replace(/^v/, "");
} else if (process.env.GITHUB_RUN_NUMBER) {
  const base = String(pkg.version || "1.0.0").split(".");
  next = `${base[0] || 1}.${base[1] || 0}.${process.env.GITHUB_RUN_NUMBER}`;
} else {
  const tag = latestTag();
  next = tag ? bump(tag) : bump(pkg.version);
}

pkg.version = next;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
process.stdout.write(`${next}\n`);
