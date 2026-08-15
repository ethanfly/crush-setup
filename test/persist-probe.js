"use strict";

/**
 * Fresh consumer of the shipped persist API (not the unit-test file).
 *
 * Usage:
 *   node test/persist-probe.js write <stateDir>
 *   node test/persist-probe.js read  <stateDir>
 *
 * write: empty global+project dirs, add openai-compat provider + model,
 *        set model large, add stdio mcp, add skill-path, set progress false, save, exit.
 * read:  load the same dirs and print/assert those five values.
 */

const fs = require("node:fs");
const path = require("node:path");
const { load, save, apply } = require("../src/index");

function envFor(stateDir) {
  return {
    USERPROFILE: path.join(stateDir, "home"),
    HOME: path.join(stateDir, "home"),
    XDG_CONFIG_HOME: path.join(stateDir, "xdg-config"),
    LOCALAPPDATA: path.join(stateDir, "localappdata"),
  };
}

function writePhase(stateDir) {
  fs.mkdirSync(path.join(stateDir, "home"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "xdg-config"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "localappdata"), { recursive: true });
  fs.mkdirSync(path.join(stateDir, "project"), { recursive: true });
  const env = envFor(stateDir);
  let session = load({ projectDir: path.join(stateDir, "project"), env, writeScope: "project" });
  session = apply(session, "upsertProvider", [
    {
      id: "probe-compat",
      name: "Probe Compat",
      type: "openai-compat",
      base_url: "https://probe.example/v1",
      api_key: "probe-key",
    },
  ]);
  session = apply(session, "upsertModel", [
    "probe-compat",
    { id: "probe-model", name: "Probe Model", context_window: 64000 },
  ]);
  session = apply(session, "setModelSlot", [
    "large",
    { provider: "probe-compat", model: "probe-model", max_tokens: 1111 },
  ]);
  session = apply(session, "upsertMcp", [
    "probe-stdio",
    { type: "stdio", command: "probe-mcp", args: ["--stdio"] },
  ]);
  session = apply(session, "addSkillPath", [path.join(stateDir, "project", "skills")]);
  session = apply(session, "setOption", ["progress", false]);
  const written = save(session);
  const result = {
    phase: "write",
    writePath: written.path,
    provider: session.document.providers["probe-compat"].type,
    modelLarge: `${session.document.models.large.provider}/${session.document.models.large.model}`,
    mcp: session.document.mcp["probe-stdio"].type,
    skillPath: session.document.options.skills_paths[0],
    progress: session.document.options.progress,
  };
  console.log(JSON.stringify(result, null, 2));
}

function readPhase(stateDir) {
  const env = envFor(stateDir);
  const session = load({ projectDir: path.join(stateDir, "project"), env, writeScope: "project" });
  const provider = session.document.providers["probe-compat"];
  const large = session.document.models.large;
  const mcp = session.document.mcp["probe-stdio"];
  const skillPath = (session.document.options.skills_paths || [])[0];
  const progress = session.document.options.progress;

  const ok =
    provider &&
    provider.type === "openai-compat" &&
    large &&
    large.provider === "probe-compat" &&
    large.model === "probe-model" &&
    mcp &&
    mcp.type === "stdio" &&
    mcp.command === "probe-mcp" &&
    typeof skillPath === "string" &&
    skillPath.length > 0 &&
    progress === false;

  const result = {
    phase: "read",
    ok,
    provider: provider && provider.type,
    modelLarge: large ? `${large.provider}/${large.model}` : null,
    mcp: mcp && mcp.type,
    skillPath,
    progress,
    loadedPaths: session.loadedPaths,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

const [, , phase, stateDir] = process.argv;
if (!phase || !stateDir) {
  console.error("usage: node test/persist-probe.js write|read <stateDir>");
  process.exit(2);
}
if (phase === "write") writePhase(path.resolve(stateDir));
else if (phase === "read") readPhase(path.resolve(stateDir));
else {
  console.error("phase must be write or read");
  process.exit(2);
}
