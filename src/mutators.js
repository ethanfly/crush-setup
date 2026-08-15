"use strict";

const { OPTION_SPECS } = require("./constants");
const { clone, asMap, asArray, uniqueStrings, ensureOptions } = require("./document");

function upsertProvider(doc, provider) {
  const next = clone(doc);
  const id = provider.id;
  if (!id) throw new Error("provider.id is required");
  const existing = asMap(next.providers[id]);
  const { id: _id, ...rest } = provider;
  next.providers[id] = { ...existing, ...rest };
  if (provider.models) next.providers[id].models = clone(provider.models);
  return next;
}

function removeProvider(doc, id) {
  const next = clone(doc);
  delete next.providers[id];
  return next;
}

function setProviderDisabled(doc, id, disabled) {
  const next = clone(doc);
  next.providers = asMap(next.providers);
  next.providers[id] = { ...asMap(next.providers[id]), disable: Boolean(disabled) };
  return next;
}

function defaultModel(partial) {
  return {
    id: partial.id,
    name: partial.name || partial.id,
    cost_per_1m_in: partial.cost_per_1m_in ?? 0,
    cost_per_1m_out: partial.cost_per_1m_out ?? 0,
    cost_per_1m_in_cached: partial.cost_per_1m_in_cached ?? 0,
    cost_per_1m_out_cached: partial.cost_per_1m_out_cached ?? 0,
    context_window: partial.context_window ?? 128000,
    default_max_tokens: partial.default_max_tokens ?? 4096,
    can_reason: Boolean(partial.can_reason),
    supports_attachments: Boolean(partial.supports_attachments),
    ...(partial.default_reasoning_effort ? { default_reasoning_effort: partial.default_reasoning_effort } : {}),
    ...(partial.options ? { options: clone(partial.options) } : {}),
  };
}

function upsertModel(doc, providerId, model) {
  const next = clone(doc);
  next.providers = asMap(next.providers);
  if (!next.providers[providerId]) next.providers[providerId] = {};
  const p = next.providers[providerId];
  const models = asArray(p.models).filter((m) => m && m.id !== model.id);
  models.push(defaultModel(model));
  p.models = models;
  return next;
}

function removeModel(doc, providerId, modelId) {
  const next = clone(doc);
  const p = next.providers[providerId];
  if (!p) return next;
  p.models = asArray(p.models).filter((m) => !m || m.id !== modelId);
  return next;
}

function setModelSlot(doc, slot, selection) {
  if (slot !== "large" && slot !== "small") throw new Error(`unknown model slot ${slot}`);
  const next = clone(doc);
  const { provider, model, ...rest } = selection;
  if (!provider || !model) throw new Error("model slot requires provider and model");
  next.models[slot] = { provider, model, ...rest };
  return next;
}

function upsertMcp(doc, name, server) {
  const next = clone(doc);
  const existing = asMap(next.mcp[name]);
  next.mcp[name] = { type: existing.type || "stdio", ...existing, ...clone(server) };
  if (!next.mcp[name].type) next.mcp[name].type = "stdio";
  return next;
}

function removeMcp(doc, name) {
  const next = clone(doc);
  delete next.mcp[name];
  return next;
}

function setMcpDisabled(doc, name, disabled) {
  const next = clone(doc);
  next.mcp = asMap(next.mcp);
  next.mcp[name] = { ...asMap(next.mcp[name]), disabled: Boolean(disabled) };
  return next;
}

function upsertLsp(doc, name, server) {
  const next = clone(doc);
  next.lsp[name] = { ...asMap(next.lsp[name]), ...clone(server) };
  return next;
}

function removeLsp(doc, name) {
  const next = clone(doc);
  delete next.lsp[name];
  return next;
}

function setLspDisabled(doc, name, disabled) {
  const next = clone(doc);
  next.lsp = asMap(next.lsp);
  next.lsp[name] = { ...asMap(next.lsp[name]), disabled: Boolean(disabled) };
  return next;
}

function addHook(doc, event, hook) {
  const next = clone(doc);
  if (!hook || !hook.command) throw new Error("hook.command is required");
  next.hooks[event] = asArray(next.hooks[event]);
  next.hooks[event].push(clone(hook));
  return next;
}

function removeHook(doc, event, name) {
  const next = clone(doc);
  if (!name) {
    delete next.hooks[event];
    return next;
  }
  next.hooks[event] = asArray(next.hooks[event]).filter((h) => !h || h.name !== name);
  return next;
}

function updateHook(doc, event, name, patch) {
  const next = clone(doc);
  next.hooks[event] = asArray(next.hooks[event]).map((h) => {
    if (h && h.name === name) return { ...h, ...clone(patch), name: patch.name || name };
    return h;
  });
  return next;
}

function allowTool(doc, tool) {
  const next = clone(doc);
  next.permissions.allowed_tools = uniqueStrings([...asArray(next.permissions.allowed_tools), tool]);
  return next;
}

function removeAllowedTool(doc, tool) {
  const next = clone(doc);
  next.permissions.allowed_tools = asArray(next.permissions.allowed_tools).filter((t) => t !== tool);
  return next;
}

function denyTool(doc, tool) {
  const next = clone(doc);
  const opts = ensureOptions(next);
  opts.disabled_tools = uniqueStrings([...asArray(opts.disabled_tools), tool]);
  return next;
}

function removeDeniedTool(doc, tool) {
  const next = clone(doc);
  const opts = ensureOptions(next);
  opts.disabled_tools = asArray(opts.disabled_tools).filter((t) => t !== tool);
  return next;
}

function setOption(doc, key, value) {
  const next = clone(doc);
  const opts = ensureOptions(next);
  if (key === "attribution-trailer-style") {
    opts.attribution = { generated_with: true, ...asMap(opts.attribution), trailer_style: value };
    return next;
  }
  if (key === "attribution-generated-with") {
    opts.attribution = { ...asMap(opts.attribution), generated_with: Boolean(value) };
    return next;
  }
  const spec = OPTION_SPECS[key];
  if (!spec) throw new Error(`unknown option ${key}`);
  if (spec.kind === "list") {
    opts[spec.jsonKey] = uniqueStrings([...asArray(opts[spec.jsonKey]), value]);
    return next;
  }
  if (spec.kind === "bool") {
    let bv = Boolean(value);
    if (spec.inverted) bv = !bv;
    opts[spec.jsonKey] = bv;
    return next;
  }
  opts[spec.jsonKey] = value;
  return next;
}

function resetOptionList(doc, key) {
  const next = clone(doc);
  const spec = OPTION_SPECS[key];
  if (!spec || spec.kind !== "list") throw new Error(`option reset only applies to list keys, got ${key}`);
  ensureOptions(next)[spec.jsonKey] = [];
  return next;
}

function setOptionUi(doc, key, value) {
  const next = clone(doc);
  const opts = ensureOptions(next);
  opts.tui = asMap(opts.tui);
  if (key === "compact") opts.tui.compact_mode = Boolean(value);
  else if (key === "transparent") opts.tui.transparent = Boolean(value);
  else if (key === "diff") opts.tui.diff_mode = value;
  else if (key === "scrollbar") opts.tui.scrollbar = value;
  else if (key === "completions-max-depth") {
    opts.tui.completions = { ...asMap(opts.tui.completions), max_depth: Number(value) };
  } else if (key === "completions-max-items") {
    opts.tui.completions = { ...asMap(opts.tui.completions), max_items: Number(value) };
  } else {
    throw new Error(`unknown option ui key ${key}`);
  }
  return next;
}

function setEnv(doc, key, value) {
  const next = clone(doc);
  next.env = asMap(next.env);
  next.env[key] = String(value);
  return next;
}

function removeEnv(doc, key) {
  const next = clone(doc);
  next.env = asMap(next.env);
  delete next.env[key];
  return next;
}

function setTools(doc, tools) {
  const next = clone(doc);
  next.tools = { ...asMap(next.tools), ...clone(tools) };
  return next;
}

function removeTools(doc, key) {
  const next = clone(doc);
  next.tools = { ...asMap(next.tools) };
  delete next.tools[key];
  return next;
}

function addSkillPath(doc, dir) {
  return setOption(doc, "skill-path", dir);
}

function resetSkillPaths(doc) {
  return resetOptionList(doc, "skill-path");
}

function setSkillDisabled(doc, name, disabled) {
  const next = clone(doc);
  const opts = ensureOptions(next);
  const current = asArray(opts.disabled_skills);
  if (disabled) opts.disabled_skills = uniqueStrings([...current, name]);
  else opts.disabled_skills = current.filter((n) => n !== name);
  return next;
}

const OPS = {
  upsertProvider,
  removeProvider,
  setProviderDisabled,
  upsertModel,
  removeModel,
  setModelSlot,
  upsertMcp,
  removeMcp,
  setMcpDisabled,
  upsertLsp,
  removeLsp,
  setLspDisabled,
  addHook,
  removeHook,
  updateHook,
  allowTool,
  removeAllowedTool,
  denyTool,
  removeDeniedTool,
  setOption,
  resetOptionList,
  setOptionUi,
  setEnv,
  removeEnv,
  setTools,
  removeTools,
  addSkillPath,
  resetSkillPaths,
  setSkillDisabled,
};

function applyOp(doc, op, args) {
  const fn = OPS[op];
  if (!fn) throw new Error(`unknown op ${op}`);
  return fn(doc, ...asArray(args));
}

module.exports = {
  ...OPS,
  applyOp,
  defaultModel,
};
