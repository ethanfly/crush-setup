"use strict";

function emptyDocument() {
  return {
    providers: {},
    models: {},
    mcp: {},
    lsp: {},
    hooks: {},
    permissions: { allowed_tools: [] },
    options: {},
    env: {},
    tools: {},
  };
}

function clone(value) {
  return structuredClone(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asMap(value) {
  return isPlainObject(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(list) {
  const out = [];
  const seen = new Set();
  for (const item of asArray(list)) {
    const s = String(item);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function mergeModelArrays(base, overlay) {
  const byId = new Map();
  for (const item of asArray(base)) {
    if (isPlainObject(item) && item.id != null) byId.set(String(item.id), item);
  }
  for (const item of asArray(overlay)) {
    if (isPlainObject(item) && item.id != null) byId.set(String(item.id), { ...byId.get(String(item.id)), ...item });
  }
  return [...byId.values()];
}

function mergeProvider(base, overlay) {
  const next = { ...asMap(base), ...asMap(overlay) };
  if (overlay && overlay.models) {
    next.models = mergeModelArrays(base && base.models, overlay.models);
  } else if (base && base.models && !next.models) {
    next.models = clone(base.models);
  }
  if (overlay && overlay.extra_headers) {
    next.extra_headers = { ...asMap(base && base.extra_headers), ...asMap(overlay.extra_headers) };
  }
  if (overlay && overlay.extra_body) {
    next.extra_body = { ...asMap(base && base.extra_body), ...asMap(overlay.extra_body) };
  }
  if (overlay && overlay.provider_options) {
    next.provider_options = { ...asMap(base && base.provider_options), ...asMap(overlay.provider_options) };
  }
  return next;
}

function mergeNamedMap(base, overlay, itemMerge) {
  const next = { ...asMap(base) };
  for (const [key, value] of Object.entries(asMap(overlay))) {
    next[key] = itemMerge ? itemMerge(next[key], value) : isPlainObject(value) && isPlainObject(next[key])
      ? { ...next[key], ...value }
      : clone(value);
  }
  return next;
}

function mergeOptions(base, overlay) {
  const next = { ...asMap(base), ...asMap(overlay) };
  const listKeys = ["context_paths", "global_context_paths", "skills_paths", "disabled_skills", "disabled_tools"];
  for (const key of listKeys) {
    if (base && Array.isArray(base[key]) && overlay && Array.isArray(overlay[key])) {
      next[key] = uniqueStrings([...base[key], ...overlay[key]]);
    } else if (overlay && Array.isArray(overlay[key])) {
      next[key] = uniqueStrings(overlay[key]);
    } else if (base && Array.isArray(base[key])) {
      next[key] = uniqueStrings(base[key]);
    }
  }
  if ((base && base.tui) || (overlay && overlay.tui)) {
    const bt = asMap(base && base.tui);
    const ot = asMap(overlay && overlay.tui);
    next.tui = { ...bt, ...ot };
    if (bt.completions || ot.completions) {
      next.tui.completions = { ...asMap(bt.completions), ...asMap(ot.completions) };
    }
  }
  if ((base && base.attribution) || (overlay && overlay.attribution)) {
    next.attribution = { ...asMap(base && base.attribution), ...asMap(overlay && overlay.attribution) };
  }
  return next;
}

function mergeTools(base, overlay) {
  const b = asMap(base);
  const o = asMap(overlay);
  const next = { ...b, ...o };
  for (const key of ["ls", "grep", "glob"]) {
    if (b[key] || o[key]) next[key] = { ...asMap(b[key]), ...asMap(o[key]) };
  }
  return next;
}

function mergeHooks(base, overlay) {
  const next = { ...asMap(base) };
  for (const [event, hooks] of Object.entries(asMap(overlay))) {
    const existing = asArray(next[event]);
    next[event] = [...existing, ...asArray(hooks).map(clone)];
  }
  return next;
}

/**
 * Merge Crush config documents. Later documents win on scalar/object fields;
 * named maps (providers/mcp/lsp) merge by key; option lists and hooks accumulate.
 */
function mergeDocuments(docs) {
  let acc = emptyDocument();
  for (const raw of docs) {
    if (!raw || typeof raw !== "object") continue;
    const extra = {};
    for (const [key, value] of Object.entries(raw)) {
      if (["providers", "models", "mcp", "lsp", "hooks", "permissions", "options", "env", "tools", "$schema"].includes(key)) {
        continue;
      }
      extra[key] = clone(value);
    }
    acc = {
      ...acc,
      ...extra,
      providers: mergeNamedMap(acc.providers, raw.providers, mergeProvider),
      models: { ...asMap(acc.models), ...asMap(raw.models) },
      mcp: mergeNamedMap(acc.mcp, raw.mcp),
      lsp: mergeNamedMap(acc.lsp, raw.lsp),
      hooks: mergeHooks(acc.hooks, raw.hooks),
      permissions: {
        allowed_tools: uniqueStrings([
          ...asArray(acc.permissions && acc.permissions.allowed_tools),
          ...asArray(raw.permissions && raw.permissions.allowed_tools),
        ]),
      },
      options: mergeOptions(acc.options, raw.options),
      env: { ...asMap(acc.env), ...asMap(raw.env) },
      tools: mergeTools(acc.tools, raw.tools),
    };
    if (raw.$schema) acc.$schema = raw.$schema;
  }
  return acc;
}

function normalizeDocument(raw) {
  return mergeDocuments([emptyDocument(), raw || {}]);
}

function ensureOptions(doc) {
  if (!doc.options || typeof doc.options !== "object") doc.options = {};
  return doc.options;
}

module.exports = {
  emptyDocument,
  clone,
  isPlainObject,
  asMap,
  asArray,
  uniqueStrings,
  mergeDocuments,
  mergeTools,
  normalizeDocument,
  ensureOptions,
};
