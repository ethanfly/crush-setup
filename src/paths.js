"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { PROJECT_MERGE_ORDER, PROJECT_SKILL_SUBDIRS } = require("./constants");

function homeDir(env) {
  return env.USERPROFILE || env.HOME || env.HOMEPATH || "";
}

function configHome(env) {
  if (env.XDG_CONFIG_HOME) return env.XDG_CONFIG_HOME;
  const home = homeDir(env);
  return home ? path.join(home, ".config") : "";
}

function localAppData(env) {
  if (env.LOCALAPPDATA) return env.LOCALAPPDATA;
  const home = homeDir(env);
  return home ? path.join(home, "AppData", "Local") : "";
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve Crush lookup locations. Matches internal/config/load.go on Windows:
 * global user config is %XDG_CONFIG_HOME%/crush or %USERPROFILE%\.config\crush;
 * machine JSON is %LOCALAPPDATA%\crush\crush.json (read source, Crush-owned).
 */
function resolvePaths({ projectDir, env = process.env } = {}) {
  const home = homeDir(env);
  const xdg = configHome(env);
  const ladd = localAppData(env);

  let globalDir;
  let globalJson;
  if (env.CRUSH_GLOBAL_CONFIG) {
    globalDir = env.CRUSH_GLOBAL_CONFIG;
    globalJson = path.join(globalDir, "crush.json");
  } else {
    globalDir = xdg ? path.join(xdg, "crush") : "";
    globalJson = globalDir ? path.join(globalDir, "crush.json") : "";
  }
  const globalCrushrc = globalDir ? path.join(globalDir, "crushrc") : "";

  let machineJson;
  if (env.CRUSH_GLOBAL_DATA) {
    machineJson = path.join(env.CRUSH_GLOBAL_DATA, "crush.json");
  } else {
    machineJson = ladd ? path.join(ladd, "crush", "crush.json") : "";
  }

  const projectFiles = [];
  if (projectDir) {
    for (const name of PROJECT_MERGE_ORDER) {
      projectFiles.push(path.join(projectDir, name));
    }
  }

  const skillDirs = [];
  if (env.CRUSH_SKILLS_DIR) {
    skillDirs.push(env.CRUSH_SKILLS_DIR);
  } else {
    if (xdg) {
      skillDirs.push(path.join(xdg, "crush", "skills"));
      skillDirs.push(path.join(xdg, "agents", "skills"));
    }
    if (home) {
      skillDirs.push(path.join(home, ".agents", "skills"));
      skillDirs.push(path.join(home, ".claude", "skills"));
    }
    if (process.platform === "win32" && ladd) {
      skillDirs.push(path.join(ladd, "crush", "skills"));
      skillDirs.push(path.join(ladd, "agents", "skills"));
    }
  }

  const projectSkillDirs = [];
  if (projectDir) {
    for (const sub of PROJECT_SKILL_SUBDIRS) {
      projectSkillDirs.push(path.join(projectDir, sub));
    }
  }

  return {
    home,
    configHome: xdg,
    localAppData: ladd,
    globalDir,
    globalJson,
    globalCrushrc,
    machineJson,
    projectDir: projectDir || "",
    projectFiles,
    skillDirs,
    projectSkillDirs,
  };
}

/**
 * Files Crush would load, low-to-high priority (later wins).
 * Machine JSON is included as a read source.
 */
function lookupConfigFiles(paths) {
  const ordered = [];
  if (paths.globalJson) ordered.push({ path: paths.globalJson, kind: "json", scope: "global", writable: true });
  if (paths.globalCrushrc) ordered.push({ path: paths.globalCrushrc, kind: "crushrc", scope: "global", writable: true });
  if (paths.machineJson) ordered.push({ path: paths.machineJson, kind: "json", scope: "machine", writable: false });
  for (const p of paths.projectFiles) {
    const base = path.basename(p);
    const kind = base.endsWith("rc") ? "crushrc" : "json";
    ordered.push({ path: p, kind, scope: "project", writable: true });
  }
  return ordered;
}

function existingFiles(entries) {
  return entries.filter((e) => e.path && exists(e.path));
}

function isShellConfig(filePath) {
  const base = path.basename(filePath);
  return base === "crushrc" || base === ".crushrc";
}

module.exports = {
  homeDir,
  configHome,
  localAppData,
  resolvePaths,
  lookupConfigFiles,
  existingFiles,
  isShellConfig,
  exists,
};
