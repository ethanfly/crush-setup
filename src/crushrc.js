"use strict";

const { OPTION_SPECS, MANAGED_CRUSHRC_MARK, JSON_SCHEMA_URL } = require("./constants");
const { emptyDocument, asMap, asArray, uniqueStrings } = require("./document");

function tokenize(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "#") break;
    if (ch === '"' || ch === "'") {
      const q = ch;
      i += 1;
      let s = "";
      while (i < line.length && line[i] !== q) {
        if (line[i] === "\\" && i + 1 < line.length) {
          i += 1;
          s += line[i];
          i += 1;
          continue;
        }
        s += line[i];
        i += 1;
      }
      if (line[i] === q) i += 1;
      tokens.push(s);
      continue;
    }
    let s = "";
    while (i < line.length && !/\s/.test(line[i]) && line[i] !== "#") {
      s += line[i];
      i += 1;
    }
    if (s) tokens.push(s);
  }
  return tokens;
}

function parseBool(s) {
  const v = String(s).toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  throw new Error(`invalid boolean ${s}`);
}

function parseJSON(s) {
  return JSON.parse(s);
}

function childMap(parent, key) {
  if (!parent[key] || typeof parent[key] !== "object" || Array.isArray(parent[key])) {
    parent[key] = {};
  }
  return parent[key];
}

function section(root, key) {
  return childMap(root, key);
}

function applyFlags(specs, args, start, target) {
  let i = start;
  while (i < args.length) {
    let flag = args[i];
    let inline;
    if (flag.includes("=") && flag.startsWith("--")) {
      const cut = flag.indexOf("=");
      inline = flag.slice(cut + 1);
      flag = flag.slice(0, cut);
    }
    const spec = specs.find((s) => s.name === flag);
    if (!spec) {
      i += 1;
      continue;
    }
    i += 1;
    if (spec.kind === "boolTrue") {
      target[spec.jsonKey] = true;
      continue;
    }
    const take = () => {
      if (inline !== undefined) {
        const v = inline;
        inline = undefined;
        return v;
      }
      if (i >= args.length) throw new Error(`missing value for ${flag}`);
      return args[i++];
    };
    if (spec.kind === "bool") {
      let raw = "true";
      if (inline !== undefined) raw = take();
      else if (i < args.length && !String(args[i]).startsWith("--")) raw = take();
      target[spec.jsonKey] = parseBool(raw);
    } else if (spec.kind === "string") {
      if (spec.op === "append") {
        target[spec.jsonKey] = asArray(target[spec.jsonKey]);
        target[spec.jsonKey].push(take());
      } else {
        target[spec.jsonKey] = take();
      }
    } else if (spec.kind === "int") {
      target[spec.jsonKey] = Number.parseInt(take(), 10);
    } else if (spec.kind === "float") {
      target[spec.jsonKey] = Number.parseFloat(take());
    } else if (spec.kind === "keyValue") {
      const k = take();
      const v = take();
      childMap(target, spec.child)[k] = v;
    } else if (spec.kind === "jsonObject") {
      const obj = parseJSON(take());
      target[spec.child] = { ...asMap(target[spec.child]), ...asMap(obj) };
    } else if (spec.kind === "jsonAny") {
      target[spec.jsonKey] = parseJSON(take());
    }
  }
  return target;
}

const providerFlags = [
  { name: "--name", jsonKey: "name", kind: "string" },
  { name: "--type", jsonKey: "type", kind: "string" },
  { name: "--api-key", jsonKey: "api_key", kind: "string" },
  { name: "--base-url", jsonKey: "base_url", kind: "string" },
  { name: "--disable", jsonKey: "disable", kind: "bool" },
  { name: "--flat-rate", jsonKey: "flat_rate", kind: "bool" },
  { name: "--discover-models", jsonKey: "discover_models", kind: "bool" },
  { name: "--system-prompt-prefix", jsonKey: "system_prompt_prefix", kind: "string" },
  { name: "--extra-header", child: "extra_headers", kind: "keyValue" },
  { name: "--extra-body", child: "extra_body", kind: "jsonObject" },
  { name: "--provider-options", child: "provider_options", kind: "jsonObject" },
];

const modelAddFlags = [
  { name: "--name", jsonKey: "name", kind: "string" },
  { name: "--context-window", jsonKey: "context_window", kind: "int" },
  { name: "--default-max-tokens", jsonKey: "default_max_tokens", kind: "int" },
  { name: "--can-reason", jsonKey: "can_reason", kind: "bool" },
  { name: "--supports-images", jsonKey: "supports_attachments", kind: "bool" },
  { name: "--price-input", jsonKey: "cost_per_1m_in", kind: "float" },
  { name: "--price-output", jsonKey: "cost_per_1m_out", kind: "float" },
  { name: "--price-cache-create", jsonKey: "cost_per_1m_out_cached", kind: "float" },
  { name: "--price-cache-hit", jsonKey: "cost_per_1m_in_cached", kind: "float" },
  { name: "--reasoning-effort", jsonKey: "default_reasoning_effort", kind: "string" },
];

const modelSelectFlags = [
  { name: "--think", jsonKey: "think", kind: "boolTrue" },
  { name: "--reasoning-effort", jsonKey: "reasoning_effort", kind: "string" },
  { name: "--max-tokens", jsonKey: "max_tokens", kind: "int" },
  { name: "--temperature", jsonKey: "temperature", kind: "float" },
  { name: "--top-p", jsonKey: "top_p", kind: "float" },
  { name: "--top-k", jsonKey: "top_k", kind: "int" },
  { name: "--frequency-penalty", jsonKey: "frequency_penalty", kind: "float" },
  { name: "--presence-penalty", jsonKey: "presence_penalty", kind: "float" },
  { name: "--provider-options", child: "provider_options", kind: "jsonObject" },
];

const mcpFlags = [
  { name: "--type", jsonKey: "type", kind: "string" },
  { name: "--command", jsonKey: "command", kind: "string" },
  { name: "--args", jsonKey: "args", kind: "string", op: "append" },
  { name: "--env", child: "env", kind: "keyValue" },
  { name: "--url", jsonKey: "url", kind: "string" },
  { name: "--header", child: "headers", kind: "keyValue" },
  { name: "--timeout", jsonKey: "timeout", kind: "int" },
  { name: "--disabled", jsonKey: "disabled", kind: "bool" },
  { name: "--disabled-tools", jsonKey: "disabled_tools", kind: "string", op: "append" },
  { name: "--enabled-tools", jsonKey: "enabled_tools", kind: "string", op: "append" },
  { name: "--oauth", jsonKey: "oauth", kind: "bool" },
  { name: "--oauth-client-id", jsonKey: "oauth_client_id", kind: "string" },
  { name: "--oauth-client-secret", jsonKey: "oauth_client_secret", kind: "string" },
  { name: "--oauth-callback-port", jsonKey: "oauth_callback_port", kind: "int" },
];

const lspFlags = [
  { name: "--command", jsonKey: "command", kind: "string" },
  { name: "--args", jsonKey: "args", kind: "string", op: "append" },
  { name: "--env", child: "env", kind: "keyValue" },
  { name: "--filetypes", jsonKey: "filetypes", kind: "string", op: "append" },
  { name: "--root-markers", jsonKey: "root_markers", kind: "string", op: "append" },
  { name: "--timeout", jsonKey: "timeout", kind: "int" },
  { name: "--disabled", jsonKey: "disabled", kind: "bool" },
  { name: "--init-options", jsonKey: "init_options", kind: "jsonAny" },
  { name: "--options", jsonKey: "options", kind: "jsonAny" },
];

const hookFlags = [
  { name: "--command", jsonKey: "command", kind: "string" },
  { name: "--matcher", jsonKey: "matcher", kind: "string" },
  { name: "--timeout", jsonKey: "timeout", kind: "int" },
  { name: "--name", jsonKey: "name", kind: "string" },
];

function splitProviderModel(s) {
  const idx = s.indexOf("/");
  if (idx <= 0 || idx === s.length - 1) return null;
  return { provider: s.slice(0, idx), id: s.slice(idx + 1) };
}

function applyCommand(root, tokens) {
  if (!tokens.length) return;
  const [cmd, sub, ...rest] = tokens;
  if (cmd === "provider") {
    if (sub === "add") {
      const id = rest[0];
      if (!id) return;
      const p = childMap(section(root, "providers"), id);
      applyFlags(providerFlags, rest, 1, p);
    } else if (sub === "remove" || sub === "rm") {
      delete section(root, "providers")[rest[0]];
    }
    return;
  }
  if (cmd === "model") {
    if (sub === "add") {
      const ref = splitProviderModel(rest[0] || "");
      if (!ref) return;
      const providers = section(root, "providers");
      if (!providers[ref.provider]) providers[ref.provider] = {};
      const model = { id: ref.id };
      applyFlags(modelAddFlags, rest, 1, model);
      const p = childMap(providers, ref.provider);
      const models = asArray(p.models).filter((m) => !m || m.id !== ref.id);
      models.push(model);
      p.models = models;
    } else if (sub === "remove" || sub === "rm") {
      const ref = splitProviderModel(rest[0] || "");
      if (!ref) return;
      const p = section(root, "providers")[ref.provider];
      if (p && Array.isArray(p.models)) {
        p.models = p.models.filter((m) => !m || m.id !== ref.id);
      }
    } else if (sub === "large" || sub === "small") {
      if (!rest[0]) return;
      const ref = splitProviderModel(rest[0]);
      if (!ref) return;
      const sel = childMap(section(root, "models"), sub);
      sel.provider = ref.provider;
      sel.model = ref.id;
      applyFlags(modelSelectFlags, rest, 1, sel);
    }
    return;
  }
  if (cmd === "mcp") {
    if (sub === "add") {
      const name = rest[0];
      if (!name) return;
      const m = childMap(section(root, "mcp"), name);
      if (m.type == null) m.type = "stdio";
      applyFlags(mcpFlags, rest, 1, m);
    } else if (sub === "remove" || sub === "rm") {
      delete section(root, "mcp")[rest[0]];
    }
    return;
  }
  if (cmd === "lsp") {
    if (sub === "add") {
      const name = rest[0];
      if (!name) return;
      const l = childMap(section(root, "lsp"), name);
      applyFlags(lspFlags, rest, 1, l);
    } else if (sub === "remove" || sub === "rm") {
      delete section(root, "lsp")[rest[0]];
    }
    return;
  }
  if (cmd === "hook") {
    if (sub === "add") {
      const event = rest[0];
      if (!event) return;
      const h = {};
      applyFlags(hookFlags, rest, 1, h);
      if (!h.command) return;
      const hooks = section(root, "hooks");
      hooks[event] = asArray(hooks[event]);
      hooks[event].push(h);
    } else if (sub === "remove" || sub === "rm") {
      const event = rest[0];
      const flags = {};
      applyFlags([{ name: "--name", jsonKey: "name", kind: "string" }], rest, 1, flags);
      const hooks = section(root, "hooks");
      if (!flags.name) delete hooks[event];
      else hooks[event] = asArray(hooks[event]).filter((h) => !h || h.name !== flags.name);
    }
    return;
  }
  if (cmd === "permissions") {
    if (sub === "allow") {
      const perms = section(root, "permissions");
      perms.allowed_tools = uniqueStrings([...asArray(perms.allowed_tools), ...rest]);
    } else if (sub === "deny") {
      const opts = section(root, "options");
      opts.disabled_tools = uniqueStrings([...asArray(opts.disabled_tools), ...rest]);
    }
    return;
  }
  if (cmd === "option") {
    applyOption(root, [sub, ...rest]);
  }
}

function applyOption(root, args) {
  const key = args[0];
  const opts = section(root, "options");
  if (key === "ui") {
    applyOptionUi(opts, args.slice(1));
    return;
  }
  if (key === "reset") {
    const spec = OPTION_SPECS[args[1]];
    if (spec && spec.kind === "list") opts[spec.jsonKey] = [];
    return;
  }
  if (key === "attribution-trailer-style") {
    const val = args[1];
    const attr = childMap(opts, "attribution");
    if (attr.generated_with == null) attr.generated_with = true;
    attr.trailer_style = val;
    return;
  }
  if (key === "attribution-generated-with") {
    const attr = childMap(opts, "attribution");
    attr.generated_with = args[1] == null || args[1] === "" ? true : parseBool(args[1]);
    return;
  }
  const spec = OPTION_SPECS[key];
  if (!spec) return;
  if (spec.kind === "list") {
    if (args[1] == null) return;
    opts[spec.jsonKey] = uniqueStrings([...asArray(opts[spec.jsonKey]), args[1]]);
    return;
  }
  if (spec.kind === "bool") {
    let bv = args[1] == null || args[1] === "" ? true : parseBool(args[1]);
    if (spec.inverted) bv = !bv;
    opts[spec.jsonKey] = bv;
    return;
  }
  if (args[1] != null) opts[spec.jsonKey] = args[1];
}

function applyOptionUi(opts, args) {
  const key = args[0];
  const value = args[1];
  const ui = childMap(opts, "tui");
  if (key === "compact" || key === "transparent") {
    ui[key === "compact" ? "compact_mode" : "transparent"] = parseBool(value);
  } else if (key === "diff") {
    ui.diff_mode = value;
  } else if (key === "scrollbar") {
    ui.scrollbar = value;
  } else if (key === "completions-max-depth") {
    childMap(ui, "completions").max_depth = Number.parseInt(value, 10);
  } else if (key === "completions-max-items") {
    childMap(ui, "completions").max_items = Number.parseInt(value, 10);
  }
}

const CONTROL_START = /^(if|elif|else|fi|for|while|until|do|done|case|esac|function|source|\.|export|return|exit)\b/;

/**
 * Parse crushrc builtin-command language into a Crush JSON document.
 * Control-flow / source lines are recorded as unparsed, not executed.
 */
function parseCrushrc(source) {
  const root = emptyDocument();
  const unparsed = [];
  const text = String(source || "").replace(/\r\n/g, "\n");
  const logical = [];
  let buf = "";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\\$/, (m, offset, s) => {
      // handled below
      return m;
    });
    if (/\\\s*$/.test(rawLine)) {
      buf += rawLine.replace(/\\\s*$/, " ");
      continue;
    }
    buf += rawLine;
    logical.push(buf);
    buf = "";
  }
  if (buf) logical.push(buf);

  for (const line of logical) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (CONTROL_START.test(trimmed) || trimmed.includes("$(") && /^\s*(if|\[\[)/.test(trimmed)) {
      unparsed.push(line);
      continue;
    }
    // Split on `;` that are not inside quotes — simple path: one command per line.
    const tokens = tokenize(trimmed);
    if (!tokens.length) continue;
    const known = ["provider", "model", "mcp", "lsp", "hook", "permissions", "option"];
    if (!known.includes(tokens[0])) {
      unparsed.push(line);
      continue;
    }
    applyCommand(root, tokens);
  }
  return { document: root, unparsed };
}

function shellQuote(value) {
  const s = String(value);
  if (s === "") return '""';
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function flagKV(flag, obj) {
  const lines = [];
  for (const [k, v] of Object.entries(obj || {})) {
    lines.push(`${flag} ${shellQuote(k)} ${shellQuote(v)}`);
  }
  return lines;
}

function jsonFlag(flag, value) {
  if (value == null) return [];
  return [`${flag} ${shellQuote(JSON.stringify(value))}`];
}

function boolFlag(flag, value) {
  if (value == null) return [];
  return [`${flag} ${value ? "true" : "false"}`];
}

function strFlag(flag, value) {
  if (value == null || value === "") return [];
  return [`${flag} ${shellQuote(value)}`];
}

function numFlag(flag, value) {
  if (value == null || value === "") return [];
  return [`${flag} ${value}`];
}

function repeatFlag(flag, values) {
  return asArray(values).map((v) => `${flag} ${shellQuote(v)}`);
}

/**
 * Generate a crushrc of only builtin commands from a config document.
 */
function generateCrushrc(doc) {
  const lines = [MANAGED_CRUSHRC_MARK, ""];
  const providers = asMap(doc.providers);
  for (const [id, p] of Object.entries(providers)) {
    const parts = ["provider add", shellQuote(id)];
    parts.push(...strFlag("--name", p.name));
    parts.push(...strFlag("--type", p.type));
    parts.push(...strFlag("--api-key", p.api_key));
    parts.push(...strFlag("--base-url", p.base_url));
    parts.push(...boolFlag("--disable", p.disable));
    parts.push(...boolFlag("--flat-rate", p.flat_rate));
    parts.push(...boolFlag("--discover-models", p.discover_models));
    parts.push(...strFlag("--system-prompt-prefix", p.system_prompt_prefix));
    parts.push(...flagKV("--extra-header", p.extra_headers));
    parts.push(...jsonFlag("--extra-body", p.extra_body && Object.keys(p.extra_body).length ? p.extra_body : null));
    parts.push(...jsonFlag("--provider-options", p.provider_options && Object.keys(p.provider_options).length ? p.provider_options : null));
    lines.push(parts.join(" "));
    for (const model of asArray(p.models)) {
      if (!model || !model.id) continue;
      const mp = ["model add", shellQuote(`${id}/${model.id}`)];
      mp.push(...strFlag("--name", model.name));
      mp.push(...numFlag("--context-window", model.context_window));
      mp.push(...numFlag("--default-max-tokens", model.default_max_tokens));
      mp.push(...boolFlag("--can-reason", model.can_reason));
      mp.push(...boolFlag("--supports-images", model.supports_attachments));
      mp.push(...numFlag("--price-input", model.cost_per_1m_in));
      mp.push(...numFlag("--price-output", model.cost_per_1m_out));
      mp.push(...numFlag("--price-cache-create", model.cost_per_1m_out_cached));
      mp.push(...numFlag("--price-cache-hit", model.cost_per_1m_in_cached));
      mp.push(...strFlag("--reasoning-effort", model.default_reasoning_effort));
      lines.push(mp.join(" "));
    }
  }

  const models = asMap(doc.models);
  for (const slot of ["large", "small"]) {
    const sel = models[slot];
    if (!sel || !sel.provider || !sel.model) continue;
    const parts = ["model", slot, shellQuote(`${sel.provider}/${sel.model}`)];
    if (sel.think) parts.push("--think");
    parts.push(...strFlag("--reasoning-effort", sel.reasoning_effort));
    parts.push(...numFlag("--max-tokens", sel.max_tokens));
    parts.push(...numFlag("--temperature", sel.temperature));
    parts.push(...numFlag("--top-p", sel.top_p));
    parts.push(...numFlag("--top-k", sel.top_k));
    parts.push(...numFlag("--frequency-penalty", sel.frequency_penalty));
    parts.push(...numFlag("--presence-penalty", sel.presence_penalty));
    parts.push(...jsonFlag("--provider-options", sel.provider_options && Object.keys(sel.provider_options).length ? sel.provider_options : null));
    lines.push(parts.join(" "));
  }

  for (const [name, m] of Object.entries(asMap(doc.mcp))) {
    const parts = ["mcp add", shellQuote(name)];
    parts.push(...strFlag("--type", m.type || "stdio"));
    parts.push(...strFlag("--command", m.command));
    parts.push(...repeatFlag("--args", m.args));
    parts.push(...flagKV("--env", m.env));
    parts.push(...strFlag("--url", m.url));
    parts.push(...flagKV("--header", m.headers));
    parts.push(...numFlag("--timeout", m.timeout));
    parts.push(...boolFlag("--disabled", m.disabled));
    parts.push(...repeatFlag("--disabled-tools", m.disabled_tools));
    parts.push(...repeatFlag("--enabled-tools", m.enabled_tools));
    parts.push(...boolFlag("--oauth", m.oauth));
    parts.push(...strFlag("--oauth-client-id", m.oauth_client_id));
    parts.push(...strFlag("--oauth-client-secret", m.oauth_client_secret));
    parts.push(...numFlag("--oauth-callback-port", m.oauth_callback_port));
    lines.push(parts.join(" "));
  }

  for (const [name, l] of Object.entries(asMap(doc.lsp))) {
    const parts = ["lsp add", shellQuote(name)];
    parts.push(...strFlag("--command", l.command));
    parts.push(...repeatFlag("--args", l.args));
    parts.push(...flagKV("--env", l.env));
    parts.push(...repeatFlag("--filetypes", l.filetypes));
    parts.push(...repeatFlag("--root-markers", l.root_markers));
    parts.push(...numFlag("--timeout", l.timeout));
    parts.push(...boolFlag("--disabled", l.disabled));
    parts.push(...jsonFlag("--init-options", l.init_options));
    parts.push(...jsonFlag("--options", l.options));
    lines.push(parts.join(" "));
  }

  for (const [event, hooks] of Object.entries(asMap(doc.hooks))) {
    for (const h of asArray(hooks)) {
      if (!h || !h.command) continue;
      const parts = ["hook add", shellQuote(event)];
      parts.push(...strFlag("--command", h.command));
      parts.push(...strFlag("--name", h.name));
      parts.push(...strFlag("--matcher", h.matcher));
      parts.push(...numFlag("--timeout", h.timeout));
      lines.push(parts.join(" "));
    }
  }

  const allowed = asArray(doc.permissions && doc.permissions.allowed_tools);
  if (allowed.length) lines.push(["permissions allow", ...allowed.map(shellQuote)].join(" "));
  const denied = asArray(doc.options && doc.options.disabled_tools);
  if (denied.length) lines.push(["permissions deny", ...denied.map(shellQuote)].join(" "));

  const o = asMap(doc.options);
  for (const [userKey, spec] of Object.entries(OPTION_SPECS)) {
    const raw = o[spec.jsonKey];
    if (raw == null) continue;
    if (spec.kind === "list") {
      for (const item of asArray(raw)) lines.push(`option ${userKey} ${shellQuote(item)}`);
    } else if (spec.kind === "bool") {
      let shown = Boolean(raw);
      if (spec.inverted) shown = !shown;
      lines.push(`option ${userKey} ${shown ? "true" : "false"}`);
    } else {
      lines.push(`option ${userKey} ${shellQuote(raw)}`);
    }
  }
  if (o.attribution) {
    if (o.attribution.generated_with != null) {
      lines.push(`option attribution-generated-with ${o.attribution.generated_with ? "true" : "false"}`);
    }
    if (o.attribution.trailer_style) {
      lines.push(`option attribution-trailer-style ${shellQuote(o.attribution.trailer_style)}`);
    }
  }
  const tui = asMap(o.tui);
  if (tui.compact_mode != null) lines.push(`option ui compact ${tui.compact_mode ? "true" : "false"}`);
  if (tui.diff_mode) lines.push(`option ui diff ${tui.diff_mode}`);
  if (tui.transparent != null) lines.push(`option ui transparent ${tui.transparent ? "true" : "false"}`);
  if (tui.scrollbar) lines.push(`option ui scrollbar ${tui.scrollbar}`);
  const completions = asMap(tui.completions);
  if (completions.max_depth != null) lines.push(`option ui completions-max-depth ${completions.max_depth}`);
  if (completions.max_items != null) lines.push(`option ui completions-max-items ${completions.max_items}`);

  lines.push("");
  return lines.join("\n");
}

function familyEmpty(key, value) {
  if (value == null) return true;
  if (key === "permissions") return asArray(value.allowed_tools).length === 0;
  if (key === "hooks") {
    return Object.keys(asMap(value)).every((event) => asArray(value[event]).length === 0);
  }
  if (key === "tools") {
    return ["ls", "grep", "glob"].every((k) => !value[k] || Object.keys(asMap(value[k])).length === 0)
      && Object.keys(asMap(value)).every((k) => ["ls", "grep", "glob"].includes(k) || value[k] == null);
  }
  if (typeof value === "object" && !Array.isArray(value)) return Object.keys(value).length === 0;
  return false;
}

function serializeJson(doc) {
  const out = { $schema: doc.$schema || JSON_SCHEMA_URL };
  const keys = ["providers", "models", "mcp", "lsp", "options", "permissions", "hooks", "env", "tools"];
  for (const key of keys) {
    if (familyEmpty(key, doc[key])) continue;
    out[key] = doc[key];
  }
  for (const [key, value] of Object.entries(doc)) {
    if (key === "$schema" || keys.includes(key)) continue;
    out[key] = value;
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

function isManagedCrushrc(source) {
  return String(source || "").includes("Generated by crush-setup");
}

module.exports = {
  tokenize,
  parseCrushrc,
  generateCrushrc,
  serializeJson,
  isManagedCrushrc,
  splitProviderModel,
};
