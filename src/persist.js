"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { resolvePaths, lookupConfigFiles, isShellConfig } = require("./paths");
const {
  emptyDocument,
  mergeDocuments,
  mergeTools,
  clone,
  asArray,
  asMap,
  normalizeDocument,
} = require("./document");
const { parseCrushrc, generateCrushrc, serializeJson, isManagedCrushrc } = require("./crushrc");
const { atomicWriteFile } = require("./atomic");
const { discoverSkills } = require("./skills");
const { applyOp } = require("./mutators");
const { MANAGED_CRUSHRC_MARK } = require("./constants");

const CRUSHRC_FAMILIES = ["providers", "models", "mcp", "lsp", "hooks", "permissions", "options"];

function readFileIfPresent(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

function loadOneFile(filePath) {
  const text = readFileIfPresent(filePath);
  if (text == null || text.trim() === "") return null;
  if (isShellConfig(filePath)) {
    const parsed = parseCrushrc(text);
    return {
      document: parsed.document,
      unparsed: parsed.unparsed,
      format: "crushrc",
      managed: isManagedCrushrc(text),
      text,
    };
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`invalid JSON in config file ${filePath}: ${err.message}`);
  }
  return { document: json, unparsed: [], format: "json", managed: false, text };
}

function overlayHasFamily(overlay, key) {
  const value = overlay && overlay[key];
  if (value == null) return false;
  if (key === "permissions") return asArray(value.allowed_tools).length > 0;
  if (key === "hooks") {
    return Object.keys(asMap(value)).some((event) => asArray(value[event]).length > 0);
  }
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function siblingJsonPath(crushrcPath) {
  const dir = path.dirname(crushrcPath);
  const base = path.basename(crushrcPath);
  if (base.startsWith(".")) return path.join(dir, ".crush.json");
  return path.join(dir, "crush.json");
}

function complementarySiblingPath(writeTarget) {
  if (!writeTarget || writeTarget.format !== "crushrc" || !writeTarget.path) return null;
  return siblingJsonPath(writeTarget.path);
}

function rebuildDocument(session) {
  const sibling = complementarySiblingPath(session.writeTarget);
  const byPath = new Map();
  for (const layer of session.loaded || []) {
    if (sibling && layer.path === sibling) continue;
    if (layer.document) byPath.set(layer.path, layer.document);
  }
  if (session.writeTarget && session.writeTarget.path) {
    byPath.set(session.writeTarget.path, session.overlay || emptyDocument());
  }
  const docs = [];
  for (const candidate of lookupConfigFiles(session.paths)) {
    if (sibling && candidate.path === sibling) continue;
    if (byPath.has(candidate.path)) docs.push(byPath.get(candidate.path));
  }
  return docs.length ? mergeDocuments(docs) : emptyDocument();
}

/**
 * Load Crush config from documented locations. Machine JSON is readable
 * but never chosen as the user write target.
 */
function load({ projectDir, env = process.env, writeScope = "global" } = {}) {
  const paths = resolvePaths({ projectDir, env });
  const candidates = lookupConfigFiles(paths);
  const loaded = [];
  const docs = [];
  const unparsedByFile = {};
  for (const entry of candidates) {
    const one = loadOneFile(entry.path);
    if (!one) continue;
    loaded.push({
      ...entry,
      format: one.format,
      managed: one.managed,
      unparsed: one.unparsed || [],
      document: one.document,
    });
    docs.push(one.document);
    if (one.unparsed && one.unparsed.length) unparsedByFile[entry.path] = one.unparsed;
  }
  const writeTarget = chooseWriteTarget(paths, loaded, writeScope);
  const overlayLayer = loaded.find((l) => l.path === writeTarget.path);
  let overlay = overlayLayer ? normalizeDocument(overlayLayer.document) : emptyDocument();
  overlay = seedJsonOnlyFamilies(overlay, loaded, writeTarget);
  // Complementary crush.json is save-time serialization only. After seeding
  // env/tools onto the crushrc overlay, drop it from merge inputs so
  // apply(removeEnv) is visible on session.document without a reload.
  const sibling = complementarySiblingPath(writeTarget);
  const mergeLayers = sibling ? loaded.filter((l) => l.path !== sibling) : loaded;
  const session = {
    loadedPaths: loaded.map((l) => l.path),
    loaded: mergeLayers,
    unparsedByFile,
    writeTarget,
    overlay,
    paths,
    projectDir: projectDir || "",
    writeScope,
    env: { ...env },
  };
  session.document = rebuildDocument(session);
  return session;
}

function isSafeCrushrc(crushrc) {
  if (!crushrc) return false;
  if (crushrc.managed) return true;
  return !(crushrc.unparsed && crushrc.unparsed.length);
}

/**
 * Seed env/tools from the sibling complementary JSON onto a crushrc overlay
 * so removeEnv / tools-key clears apply to the real json-only state.
 */
function seedJsonOnlyFamilies(overlay, loaded, writeTarget) {
  if (!writeTarget || writeTarget.format !== "crushrc") return overlay;
  const sibling = siblingJsonPath(writeTarget.path);
  const jsonLayer = loaded.find((l) => l.path === sibling);
  const src = jsonLayer && jsonLayer.document;
  if (!src) return overlay;
  const next = clone(overlay);
  next.env = { ...asMap(src.env), ...asMap(overlay.env) };
  next.tools = mergeTools(src.tools, overlay.tools);
  return next;
}

function chooseWriteTarget(paths, loaded, writeScope) {
  const scope = writeScope === "project" ? "project" : "global";
  const scoped = loaded.filter((l) => l.scope === scope && l.writable);
  const crushrc = scoped.find((l) => l.format === "crushrc");
  const json = scoped.find((l) => l.format === "json");
  if (scope === "project" && !paths.projectDir) {
    return chooseWriteTarget(paths, loaded, "global");
  }
  // Managed or parseable crushrc stays the write target even after a
  // complementary env/tools crush.json appears. crushrc wins same-dir
  // merge, so flipping to JSON would drop provider/option updates.
  if (isSafeCrushrc(crushrc)) {
    return { path: crushrc.path, format: "crushrc", scope };
  }
  if (json) return { path: json.path, format: "json", scope };
  if (scope === "project") {
    return { path: path.join(paths.projectDir, "crush.json"), format: "json", scope };
  }
  return { path: paths.globalJson, format: "json", scope };
}

function sessionDocument(session) {
  return session.document;
}

function complementaryJsonDocument(overlay) {
  const next = {};
  next.env = { ...asMap(overlay.env) };
  next.tools = clone(asMap(overlay.tools));
  for (const key of CRUSHRC_FAMILIES) delete next[key];
  if (!Object.keys(asMap(next.env)).length) delete next.env;
  if (!overlayHasFamily({ tools: next.tools }, "tools")) delete next.tools;
  return next;
}

function writeComplementaryJson(crushrcPath, overlay) {
  const jsonPath = siblingJsonPath(crushrcPath);
  const next = complementaryJsonDocument(overlay);
  const meaningful = Object.keys(next).filter((k) => k !== "$schema");
  if (!meaningful.length) {
    try {
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    } catch {
      // complementary file already gone
    }
    return null;
  }
  atomicWriteFile(jsonPath, serializeJson(next));
  return jsonPath;
}

/**
 * Persist the write-target overlay (not the merged view) so later files
 * do not re-emit lower-priority layers. crushrc cannot express env/tools;
 * those families are written to a sibling crush.json Crush still merges.
 */
function save(session) {
  if (!session || !session.writeTarget || !session.writeTarget.path) {
    throw new Error("save: session has no write target");
  }
  const dest = session.writeTarget.path;
  const format = session.writeTarget.format;
  const overlay = session.overlay || emptyDocument();
  let body;
  let complement = null;
  if (format === "crushrc") {
    body = generateCrushrc(overlay);
    atomicWriteFile(dest, body);
    complement = writeComplementaryJson(dest, overlay);
  } else {
    body = serializeJson(overlay);
    atomicWriteFile(dest, body);
  }
  session.lastWrite = { path: dest, format, bytes: Buffer.byteLength(body), complement };
  return session.lastWrite;
}

function reload(session) {
  return load({
    projectDir: session.projectDir,
    env: session.env,
    writeScope: session.writeScope,
  });
}

function apply(session, op, args) {
  if (!session.overlay) session.overlay = emptyDocument();
  session.overlay = applyOp(session.overlay, op, args);
  session.document = rebuildDocument(session);
  return session;
}

function listSkills(session) {
  const opts = session.document.options || {};
  return discoverSkills({
    paths: session.paths,
    skillsPaths: asArray(opts.skills_paths),
    disabledSkills: asArray(opts.disabled_skills),
  });
}

module.exports = {
  load,
  save,
  reload,
  apply,
  listSkills,
  loadOneFile,
  chooseWriteTarget,
  sessionDocument,
  rebuildDocument,
  siblingJsonPath,
  MANAGED_CRUSHRC_MARK,
};
