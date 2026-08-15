"use strict";

const DEFAULT_BASE = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  ollama: "http://localhost:11434/v1",
  openrouter: "https://openrouter.ai/api/v1",
  grok: "https://api.x.ai/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
  lmstudio: "http://localhost:1234/v1",
  llamacpp: "http://localhost:8080/v1",
  litellm: "http://localhost:4000/v1",
};

function resolveValue(raw, env = process.env) {
  if (raw == null || raw === "") return "";
  return String(raw).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-[^}]*)?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, braced, bare) => {
    const key = braced || bare;
    return env[key] != null ? String(env[key]) : "";
  });
}

function joinUrl(base, suffix) {
  const left = String(base || "").replace(/\/+$/, "");
  const right = String(suffix || "").replace(/^\/+/, "");
  if (!left) return `/${right}`;
  return `${left}/${right}`;
}

function stripV1(base) {
  return String(base || "").replace(/\/+$/, "").replace(/\/v1$/i, "");
}

function normalizeEntry(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return { id: raw, name: raw };
  const id = raw.id || raw.name || raw.model;
  if (!id) return null;
  return { id: String(id), name: String(raw.name || raw.display_name || id) };
}

function parseModelsBody(body) {
  if (!body) return [];
  if (Array.isArray(body.data)) return body.data.map(normalizeEntry).filter(Boolean);
  if (Array.isArray(body.models)) {
    return body.models
      .map((m) => {
        if (typeof m === "string") return { id: m, name: m };
        const id = m.id || m.name || m.model;
        if (!id) return null;
        return { id: String(id), name: String(m.name || m.id || id) };
      })
      .filter(Boolean);
  }
  if (Array.isArray(body)) return body.map(normalizeEntry).filter(Boolean);
  return [];
}

async function fetchJson(url, headers, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs || 12000);
  try {
    const res = await fetch(url, { method: "GET", headers, signal: ac.signal });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(type, apiKey, extraHeaders) {
  const headers = { Accept: "application/json" };
  if (type === "anthropic") {
    if (apiKey) headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  for (const [k, v] of Object.entries(extraHeaders || {})) {
    if (v) headers[k] = v;
  }
  return headers;
}

/**
 * Fetch models the way Crush does: GET {baseUrl}/models (OpenAI-compatible).
 * Falls back to Ollama /api/tags when type is ollama and /models fails.
 */
async function discoverModels(opts = {}) {
  const env = opts.env || process.env;
  const type = opts.type || "openai";
  const baseUrl = resolveValue(opts.baseUrl || DEFAULT_BASE[type] || "", env);
  const apiKey = resolveValue(opts.apiKey || "", env);
  const extraHeaders = {};
  for (const [k, v] of Object.entries(opts.extraHeaders || {})) {
    extraHeaders[k] = resolveValue(v, env);
  }
  if (!baseUrl) {
    return { ok: false, error: "missing base_url", models: [] };
  }

  const existing = new Set((opts.existingIds || []).map(String));
  const headers = authHeaders(type, apiKey, extraHeaders);
  const modelsUrl = joinUrl(baseUrl, "models");
  let parsed = [];
  let lastError = "";

  try {
    const res = await fetchJson(modelsUrl, headers, opts.timeoutMs);
    if (res.ok) {
      parsed = parseModelsBody(res.json);
    } else {
      lastError = `GET ${modelsUrl} → ${res.status} ${res.statusText}`.trim();
    }
  } catch (err) {
    lastError = err && err.name === "AbortError" ? "request timed out" : String(err.message || err);
  }

  if (!parsed.length && type === "ollama") {
    try {
      const tagsUrl = joinUrl(stripV1(baseUrl), "api/tags");
      const res = await fetchJson(tagsUrl, headers, opts.timeoutMs);
      if (res.ok) parsed = parseModelsBody(res.json);
      else if (!lastError) lastError = `GET ${tagsUrl} → ${res.status}`;
    } catch (err) {
      if (!lastError) lastError = String(err.message || err);
    }
  }

  const models = [];
  const seen = new Set();
  for (const m of parsed) {
    if (!m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    models.push({
      id: m.id,
      name: m.name || m.id,
      registered: existing.has(m.id),
    });
  }

  if (!models.length) {
    return { ok: false, error: lastError || "no models returned", models: [] };
  }
  return { ok: true, models, error: "" };
}

module.exports = {
  discoverModels,
  resolveValue,
  parseModelsBody,
  joinUrl,
  stripV1,
  DEFAULT_BASE,
};
