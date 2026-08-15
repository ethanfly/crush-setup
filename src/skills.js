"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SKILL_FILE = "SKILL.md";

function parseFrontMatter(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  if (!src.startsWith("---")) return { data: {}, body: src };
  const end = src.indexOf("\n---", 3);
  if (end < 0) return { data: {}, body: src };
  const yaml = src.slice(3, end).replace(/^\r?\n/, "");
  const body = src.slice(end + 4).replace(/^\r?\n/, "");
  const data = {};
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const cut = line.indexOf(":");
    if (cut < 0) continue;
    const key = line.slice(0, cut).trim();
    let value = line.slice(cut + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body };
}

function walkSkillFiles(dir, acc, depth = 0) {
  if (depth > 8) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkSkillFiles(full, acc, depth + 1);
    } else if (entry.isFile() && entry.name === SKILL_FILE) {
      acc.push(full);
    }
  }
}

function labelSource(filePath, { projectDir, skillDirs, extraPaths }) {
  const clean = path.normalize(filePath);
  if (projectDir) {
    const proj = path.normalize(projectDir);
    if (clean.startsWith(proj + path.sep) || clean.startsWith(proj + "/")) return "project";
  }
  for (const base of extraPaths || []) {
    const b = path.normalize(base);
    if (clean.startsWith(b + path.sep) || clean === b || clean.startsWith(b + "/")) return "user";
  }
  for (const base of skillDirs || []) {
    const b = path.normalize(base);
    if (clean.startsWith(b + path.sep) || clean === b || clean.startsWith(b + "/")) return "user";
  }
  return "user";
}

/**
 * Discover SKILL.md trees from Crush default dirs plus configured skill-paths.
 */
function discoverSkills({ paths, skillsPaths = [], disabledSkills = [] } = {}) {
  const dirs = [];
  const seenDir = new Set();
  const addDir = (d) => {
    if (!d) return;
    const n = path.normalize(d);
    if (seenDir.has(n)) return;
    seenDir.add(n);
    dirs.push(n);
  };
  for (const d of (paths && paths.projectSkillDirs) || []) addDir(d);
  for (const d of (paths && paths.skillDirs) || []) addDir(d);
  for (const d of skillsPaths) addDir(d);

  const disabled = new Set(disabledSkills);
  const files = [];
  for (const dir of dirs) walkSkillFiles(dir, files);

  const skills = [];
  const seenName = new Set();
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const { data, body } = parseFrontMatter(text);
    const dirName = path.basename(path.dirname(file));
    const name = data.name || dirName;
    if (seenName.has(name)) continue;
    seenName.add(name);
    skills.push({
      name,
      description: data.description || "",
      path: path.dirname(file),
      skillFilePath: file,
      source: labelSource(file, {
        projectDir: paths && paths.projectDir,
        skillDirs: paths && paths.skillDirs,
        extraPaths: skillsPaths,
      }),
      disabled: disabled.has(name),
      body,
    });
  }
  return skills;
}

module.exports = { discoverSkills, parseFrontMatter, SKILL_FILE };
