"use strict";

const { load, save, apply, listSkills, reload } = require("./persist");
const { discoverModels } = require("./discover");
const { getStatus, installCrush } = require("./install");
const {
  SECTIONS,
  PROVIDER_TYPES,
  MCP_TYPES,
  HOOK_EVENTS,
  NOTIFICATION_STYLES,
  TRAILER_STYLES,
  DIFF_MODES,
  SCROLLBAR_MODES,
  REASONING_EFFORTS,
  MAX_REASONING_EFFORT,
  OPTION_SPECS,
} = require("./constants");

function createHost() {
  let session = null;

  return {
    meta() {
      return {
        sections: SECTIONS,
        providerTypes: PROVIDER_TYPES,
        mcpTypes: MCP_TYPES,
        hookEvents: HOOK_EVENTS,
        notificationStyles: NOTIFICATION_STYLES,
        trailerStyles: TRAILER_STYLES,
        diffModes: DIFF_MODES,
        scrollbarModes: SCROLLBAR_MODES,
        reasoningEfforts: REASONING_EFFORTS,
        maxReasoningEffort: MAX_REASONING_EFFORT,
        optionKeys: Object.keys(OPTION_SPECS),
      };
    },
    async load(opts = {}) {
      session = load(opts);
      return this.state();
    },
    async save() {
      if (!session) throw new Error("nothing loaded");
      return save(session);
    },
    async reload() {
      if (!session) throw new Error("nothing loaded");
      session = reload(session);
      return this.state();
    },
    async apply(op, args) {
      if (!session) throw new Error("nothing loaded");
      session = apply(session, op, args);
      save(session);
      return this.state();
    },
    async installStatus() {
      return getStatus();
    },
    async installCrush(opts = {}) {
      return installCrush(opts);
    },
    state() {
      if (!session) return { loaded: false };
      return {
        loaded: true,
        document: session.document,
        loadedPaths: session.loadedPaths,
        writeTarget: session.writeTarget,
        lastWrite: session.lastWrite || null,
        projectDir: session.projectDir,
        writeScope: session.writeScope,
        paths: {
          globalDir: session.paths.globalDir,
          globalJson: session.paths.globalJson,
          machineJson: session.paths.machineJson,
          projectDir: session.paths.projectDir,
        },
        skills: listSkills(session),
      };
    },
    async discoverModels(opts = {}) {
      const doc = session && session.document;
      let provider = opts || {};
      if (opts.providerId && doc && doc.providers && doc.providers[opts.providerId]) {
        const p = doc.providers[opts.providerId];
        provider = {
          type: opts.type || p.type,
          baseUrl: opts.baseUrl || p.base_url,
          apiKey: opts.apiKey || p.api_key,
          extraHeaders: opts.extraHeaders || p.extra_headers,
          existingIds: (p.models || []).map((m) => m.id),
        };
      }
      return discoverModels(provider);
    },
    persistProbe(tmpDir) {
      const fs = require("node:fs");
      const path = require("node:path");
      const env = {
        USERPROFILE: path.join(tmpDir, "home"),
        HOME: path.join(tmpDir, "home"),
        XDG_CONFIG_HOME: path.join(tmpDir, "xdg-config"),
        LOCALAPPDATA: path.join(tmpDir, "localappdata"),
      };
      fs.mkdirSync(env.USERPROFILE, { recursive: true });
      fs.mkdirSync(env.XDG_CONFIG_HOME, { recursive: true });
      fs.mkdirSync(env.LOCALAPPDATA, { recursive: true });
      const projectDir = path.join(tmpDir, "project");
      fs.mkdirSync(projectDir, { recursive: true });
      let probe = load({ projectDir, env, writeScope: "project" });
      probe = apply(probe, "upsertProvider", [
        { id: "self-check", type: "openai-compat", name: "Self Check", base_url: "http://localhost" },
      ]);
      save(probe);
      const again = load({ projectDir, env, writeScope: "project" });
      const ok = again.document.providers["self-check"]
        && again.document.providers["self-check"].type === "openai-compat";
      return { ok, writePath: probe.writeTarget.path, sections: SECTIONS };
    },
  };
}

module.exports = { createHost };
