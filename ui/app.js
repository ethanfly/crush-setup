(function () {
  "use strict";

  if (typeof window === "undefined") return;

  var SECTIONS = [
    { id: "models", labelKey: "nav.models" },
    { id: "skills", labelKey: "nav.skills" },
    { id: "mcp", labelKey: "nav.mcp" },
    { id: "lsp", labelKey: "nav.lsp" },
    { id: "hooks", labelKey: "nav.hooks" },
    { id: "permissions", labelKey: "nav.permissions" },
    { id: "options", labelKey: "nav.options" },
    { id: "env", labelKey: "nav.env" },
  ];

  function t(key, vars) {
    if (window.crushI18n && typeof window.crushI18n.t === "function") {
      return window.crushI18n.t(key, vars);
    }
    return key;
  }

  var PROVIDER_TYPES = [
    "openai",
    "openai-compat",
    "anthropic",
    "ollama",
    "openrouter",
    "azure",
    "bedrock",
    "google",
    "google-vertex",
    "hyper",
    "litellm",
    "llamacpp",
    "lmstudio",
    "omlx",
    "vercel",
  ];

  var state = {
    section: "models",
    scope: "global",
    selected: null,
    data: null,
    meta: null,
    mode: "none",
    discovered: {},
    editingModel: null,
    crush: null,
    modalOpen: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function isFileProtocol() {
    return window.location.protocol === "file:";
  }

  function hasBridge() {
    return window.crushSetup && typeof window.crushSetup.load === "function";
  }

  function httpApi() {
    return {
      meta: function () {
        return fetch("/api/meta").then(function (r) {
          return r.json();
        });
      },
      load: function (opts) {
        return fetch("/api/load", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(opts || {}),
        }).then(function (r) {
          return r.json();
        });
      },
      save: function () {
        return fetch("/api/save", { method: "POST" }).then(function (r) {
          return r.json();
        });
      },
      reload: function () {
        return fetch("/api/reload", { method: "POST" }).then(function (r) {
          return r.json();
        });
      },
      apply: function (op, args) {
        return fetch("/api/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: op, args: args || [] }),
        }).then(function (r) {
          return r.json();
        });
      },
      state: function () {
        return fetch("/api/state").then(function (r) {
          return r.json();
        });
      },
      pickDirectory: function () {
        return Promise.resolve(null);
      },
      discoverModels: function (opts) {
        return fetch("/api/discover-models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(opts || {}),
        }).then(function (r) {
          return r.json();
        });
      },
      installStatus: function () {
        return fetch("/api/install-status").then(function (r) {
          return r.json();
        });
      },
      installCrush: function (opts) {
        return fetch("/api/install", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(opts || {}),
        }).then(function (r) {
          return r.json();
        });
      },
    };
  }

  var api = hasBridge() ? window.crushSetup : isFileProtocol() ? null : httpApi();

  function showStatus(msg, kind) {
    var el = $("status");
    el.hidden = !msg;
    el.textContent = msg || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  function showFileHint() {
    var el = $("fileHint");
    if (isFileProtocol() && !hasBridge()) {
      el.hidden = false;
      el.textContent = t("fileHint");
    }
  }

  function entries(obj) {
    return Object.keys(obj || {}).map(function (k) {
      return { id: k, value: obj[k] };
    });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function optionItems(list) {
    return (list || []).map(function (o) {
      if (o && typeof o === "object") {
        return { value: String(o.value), label: o.label != null ? String(o.label) : String(o.value) };
      }
      return { value: String(o), label: String(o) };
    });
  }

  function customSelectHtml(name, value, options, extraClass, labelledBy) {
    var items = optionItems(options);
    var current = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].value === String(value == null ? "" : value)) current = items[i];
    }
    if (!current) current = items[0] || { value: "", label: "—" };
    var lis = items
      .map(function (item) {
        return (
          '<li role="option" tabindex="-1" data-value="' +
          esc(item.value) +
          '"' +
          (item.value === current.value ? ' class="is-on" aria-selected="true"' : ' aria-selected="false"') +
          ">" +
          esc(item.label) +
          "</li>"
        );
      })
      .join("");
    return (
      '<div class="cselect' +
      (extraClass ? " " + extraClass : "") +
      '" data-name="' +
      esc(name) +
      '">' +
      '<input type="hidden" id="f-' +
      esc(name) +
      '" name="' +
      esc(name) +
      '" value="' +
      esc(current.value) +
      '" />' +
      '<button type="button" class="cselect-btn" aria-haspopup="listbox" aria-expanded="false"' +
      (labelledBy ? ' aria-labelledby="' + esc(labelledBy) + '"' : "") +
      ">" +
      '<span class="cselect-value">' +
      esc(current.label) +
      "</span><span class=\"cselect-caret\" aria-hidden=\"true\"></span></button>" +
      '<ul class="cselect-menu" hidden role="listbox">' +
      lis +
      "</ul></div>"
    );
  }

  function hintFor(name, extra) {
    extra = extra || {};
    if (extra.hint) return extra.hint;
    var key = "hint." + name;
    var text = t(key);
    if (!text || text === key) return "";
    return text;
  }

  function hintHtml(name, extra) {
    var text = hintFor(name, extra);
    return text ? '<div class="hint" id="h-' + esc(name) + '">' + esc(text) + "</div>" : "";
  }

  function formSection(titleKey, inner, attrs) {
    attrs = attrs || {};
    var extra = attrs.className ? " " + attrs.className : "";
    var id = attrs.id ? ' id="' + esc(attrs.id) + '"' : "";
    var hidden = attrs.hidden ? " hidden" : "";
    return (
      '<fieldset class="form-section' +
      extra +
      '"' +
      id +
      hidden +
      "><legend><span>" +
      esc(t(titleKey)) +
      "</span></legend>" +
      inner +
      "</fieldset>"
    );
  }

  function emptyHtml(message) {
    return (
      '<div class="empty"><div class="empty-pixel" aria-hidden="true"></div><p>' +
      esc(message) +
      "</p></div>"
    );
  }

  function field(name, label, value, type, extra) {
    extra = extra || {};
    var id = "f-" + name;
    var note = hintHtml(name, extra);
    var described = hintFor(name, extra) ? ' aria-describedby="h-' + esc(name) + '"' : "";
    var req = extra.required ? " required" : "";
    var reqMark = extra.required ? '<span class="req" aria-hidden="true">*</span>' : "";
    var auto = extra.autocomplete ? ' autocomplete="' + esc(extra.autocomplete) + '"' : "";
    var spell = extra.spellcheck === false ? ' spellcheck="false"' : "";
    var ro = extra.readonly ? " readonly" : "";
    var ph = extra.placeholder ? ' placeholder="' + esc(extra.placeholder) + '"' : "";
    var labelHtml =
      '<label class="field-label" for="' + id + '" id="l-' + esc(name) + '">' + esc(label) + reqMark + "</label>";

    if (type === "select") {
      return (
        '<div class="field">' +
        '<span class="field-label" id="l-' +
        esc(name) +
        '">' +
        esc(label) +
        reqMark +
        "</span>" +
        customSelectHtml(name, value, extra.options, extra.className, "l-" + name) +
        note +
        "</div>"
      );
    }
    if (type === "textarea") {
      return (
        '<div class="field">' +
        labelHtml +
        '<textarea id="' +
        id +
        '" name="' +
        esc(name) +
        '"' +
        described +
        req +
        spell +
        ro +
        ">" +
        esc(value || "") +
        "</textarea>" +
        note +
        "</div>"
      );
    }
    if (type === "checkbox") {
      return (
        '<div class="field"><label class="switch-field" for="' +
        id +
        '">' +
        '<input type="checkbox" id="' +
        id +
        '" name="' +
        esc(name) +
        '"' +
        (value ? " checked" : "") +
        described +
        " />" +
        '<span class="switch-track" aria-hidden="true"></span>' +
        '<span class="switch-label">' +
        esc(label) +
        "</span></label>" +
        note +
        "</div>"
      );
    }
    if (type === "secret") {
      return (
        '<div class="field">' +
        labelHtml +
        '<div class="input-wrap">' +
        '<input id="' +
        id +
        '" name="' +
        esc(name) +
        '" type="password" value="' +
        esc(value == null ? "" : value) +
        '" spellcheck="false" autocomplete="off"' +
        described +
        req +
        " />" +
        '<button type="button" class="reveal-btn" data-reveal="' +
        esc(id) +
        '" aria-pressed="false">' +
        esc(t("btn.reveal")) +
        "</button></div>" +
        note +
        "</div>"
      );
    }
    var inputType = type === "number" ? "number" : type === "url" ? "url" : "text";
    var mode = type === "number" ? ' inputmode="decimal"' : "";
    return (
      '<div class="field">' +
      labelHtml +
      '<input id="' +
      id +
      '" name="' +
      esc(name) +
      '" type="' +
      inputType +
      '" value="' +
      esc(value == null ? "" : value) +
      '"' +
      described +
      req +
      auto +
      spell +
      ro +
      ph +
      mode +
      " />" +
      note +
      "</div>"
    );
  }

  function clearFieldErrors(root) {
    root = root || $("form");
    if (!root) return;
    root.querySelectorAll(".field.is-invalid").forEach(function (el) {
      el.classList.remove("is-invalid");
    });
    root.querySelectorAll(".field-error").forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function setFieldError(name, message) {
    var el = document.getElementById("f-" + name);
    var wrap = el && el.closest ? el.closest(".field") : null;
    if (!wrap) {
      showStatus(message, "error");
      return;
    }
    wrap.classList.add("is-invalid");
    var err = wrap.querySelector(".field-error");
    if (!err) {
      err = document.createElement("div");
      err.className = "field-error";
      err.setAttribute("role", "alert");
      wrap.appendChild(err);
    }
    err.textContent = message;
    if (el && typeof el.focus === "function") {
      try {
        el.focus();
      } catch (ignore) {
        /* best-effort */
      }
    }
  }

  function bindWidgets(root) {
    if (!root) return;
    root.querySelectorAll(".reveal-btn").forEach(function (btn) {
      if (btn.getAttribute("data-bound")) return;
      btn.setAttribute("data-bound", "1");
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var target = document.getElementById(btn.getAttribute("data-reveal"));
        if (!target) return;
        var show = target.type === "password";
        target.type = show ? "text" : "password";
        btn.setAttribute("aria-pressed", show ? "true" : "false");
        btn.textContent = show ? t("btn.hide") : t("btn.reveal");
      });
    });
    root.querySelectorAll(".cselect").forEach(function (box) {
      if (box.getAttribute("data-bound")) return;
      box.setAttribute("data-bound", "1");
      var btn = box.querySelector(".cselect-btn");
      var menu = box.querySelector(".cselect-menu");
      var hidden = box.querySelector("input[type=hidden]");
      var labelEl = box.querySelector(".cselect-value");
      var items = menu ? menu.querySelectorAll("li") : [];
      function close() {
        box.classList.remove("open");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (menu) menu.hidden = true;
      }
      function pick(li) {
        if (!li) return;
        var value = li.getAttribute("data-value");
        if (hidden) hidden.value = value;
        if (labelEl) labelEl.textContent = li.textContent;
        items.forEach(function (item) {
          var on = item === li;
          item.classList.toggle("is-on", on);
          item.setAttribute("aria-selected", on ? "true" : "false");
        });
        close();
        if (btn) btn.focus();
        if (typeof box.onchangeBound === "function") box.onchangeBound(value);
      }
      function focusItem(index) {
        if (!items.length) return;
        var i = index;
        if (i < 0) i = items.length - 1;
        if (i >= items.length) i = 0;
        items[i].focus();
      }
      function activeIndex() {
        for (var i = 0; i < items.length; i++) {
          if (items[i] === document.activeElement) return i;
        }
        for (var j = 0; j < items.length; j++) {
          if (items[j].classList.contains("is-on")) return j;
        }
        return 0;
      }
      function open() {
        document.querySelectorAll(".cselect.open").forEach(function (other) {
          if (other !== box) {
            other.classList.remove("open");
            var otherBtn = other.querySelector(".cselect-btn");
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
            var m = other.querySelector(".cselect-menu");
            if (m) m.hidden = true;
          }
        });
        box.classList.add("open");
        if (btn) btn.setAttribute("aria-expanded", "true");
        if (menu) {
          menu.hidden = false;
          if (box.closest(".nav-slot") && btn && btn.getBoundingClientRect) {
            var rect = btn.getBoundingClientRect();
            var menuH = Math.min(menu.scrollHeight || 200, 220);
            var spaceBelow = window.innerHeight - rect.bottom;
            menu.style.left = Math.max(8, rect.left) + "px";
            if (spaceBelow < menuH + 12 && rect.top > menuH + 12) {
              menu.style.top = rect.top - menuH - 4 + "px";
            } else {
              menu.style.top = rect.bottom + 4 + "px";
            }
          }
          var current = menu.querySelector("li.is-on") || items[0];
          if (current) current.focus();
        }
      }
      if (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (box.classList.contains("open")) close();
          else open();
        });
        btn.addEventListener("keydown", function (e) {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!box.classList.contains("open")) open();
          }
        });
      }
      if (menu) {
        items.forEach(function (li) {
          li.addEventListener("click", function (e) {
            e.stopPropagation();
            pick(li);
          });
          li.addEventListener("keydown", function (e) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              focusItem(activeIndex() + 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              focusItem(activeIndex() - 1);
            } else if (e.key === "Home") {
              e.preventDefault();
              focusItem(0);
            } else if (e.key === "End") {
              e.preventDefault();
              focusItem(items.length - 1);
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick(li);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
              if (btn) btn.focus();
            }
          });
        });
      }
    });
  }

  if (!window.__crushSelectCloser && document.addEventListener) {
    window.__crushSelectCloser = true;
    document.addEventListener("click", function () {
      document.querySelectorAll(".cselect.open").forEach(function (box) {
        box.classList.remove("open");
        var menu = box.querySelector(".cselect-menu");
        if (menu) menu.hidden = true;
      });
    });
  }

  function val(name) {
    var el = document.getElementById("f-" + name);
    if (!el) return "";
    if (el.type === "checkbox") return el.checked;
    return el.value;
  }

  function parseLines(s) {
    return String(s || "")
      .split(/\r?\n|,/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }

  function parseKV(s) {
    var out = {};
    String(s || "")
      .split(/\r?\n/)
      .forEach(function (line) {
        var cut = line.indexOf("=");
        if (cut < 0) return;
        out[line.slice(0, cut).trim()] = line.slice(cut + 1).trim();
      });
    return out;
  }

  function kvText(obj) {
    return Object.keys(obj || "")
      .map(function (k) {
        return k + "=" + obj[k];
      })
      .join("\n");
  }

  function renderList() {
    var title = SECTIONS.find(function (s) {
      return s.id === state.section;
    });
    $("sectionTitle").textContent = title ? t(title.labelKey) : state.section;
    var addBtn = $("addBtn");
    addBtn.hidden = state.section === "options";
    addBtn.textContent = state.section === "skills" ? t("btn.addSkillPath") : t("btn.add");

    var list = $("list");
    list.innerHTML = "";
    renderSidebarSlots();
    renderCrushAgent();

    if (!state.data || !state.data.document) {
      list.innerHTML = emptyHtml(t("empty.load"));
      return;
    }
    var doc = state.data.document;

    if (state.section === "models") renderModels(list, doc);
    else if (state.section === "skills") renderSkills(list);
    else if (state.section === "mcp") renderNamed(list, doc.mcp, "mcp", function (v) {
      return (v.type || "stdio") + (v.url ? " · " + v.url : v.command ? " · " + v.command : "");
    }, function (v) {
      return v.disabled;
    });
    else if (state.section === "lsp") renderNamed(list, doc.lsp, "lsp", function (v) {
      return v.command || "";
    }, function (v) {
      return v.disabled;
    });
    else if (state.section === "hooks") renderHooks(list, doc);
    else if (state.section === "permissions") renderPermissions(list, doc);
    else if (state.section === "options") renderOptionsSummary(list, doc);
    else if (state.section === "env") renderEnv(list, doc);
  }

  function cardHtml(id, title, sub, badges, selected) {
    return (
      '<div class="card' +
      (selected ? " selected" : "") +
      '" data-id="' +
      esc(id) +
      '"><div><h3>' +
      esc(title) +
      "</h3><p>" +
      esc(sub) +
      "</p>" +
      badges +
      '</div><div class="card-actions"></div></div>'
    );
  }

  function modelChoices(doc) {
    var out = [];
    Object.keys(doc.providers || {}).forEach(function (pid) {
      (doc.providers[pid].models || []).forEach(function (m) {
        out.push(pid + "/" + m.id);
      });
    });
    return out;
  }

  function slotRef(sel) {
    if (!sel || !sel.provider || !sel.model) return "";
    return sel.provider + "/" + sel.model;
  }

  function parseSlotRef(ref) {
    var cut = String(ref || "").lastIndexOf("/");
    if (cut < 1) return null;
    return { provider: ref.slice(0, cut), model: ref.slice(cut + 1) };
  }

  function renderSidebarSlots() {
    var largeEl = $("slotLarge");
    var smallEl = $("slotSmall");
    if (!largeEl || !smallEl) return;
    var doc = state.data && state.data.document;
    var large = doc && doc.models && doc.models.large;
    var small = doc && doc.models && doc.models.small;
    var choices = doc ? modelChoices(doc) : [];
    function slotSelect(slot, sel) {
      var cur = slotRef(sel);
      var seen = {};
      var opts = [{ value: "", label: "—" }];
      choices.forEach(function (c) {
        if (seen[c]) return;
        seen[c] = true;
        opts.push({ value: c, label: c });
      });
      if (cur && !seen[cur]) opts.push({ value: cur, label: cur });
      var hint = hintFor(slot === "small" ? "slot_small" : "slot_large");
      return (
        '<label title="' +
        esc(hint) +
        '">' +
        esc(t(slot === "small" ? "slot.small" : "slot.large")) +
        "</label>" +
        customSelectHtml("slot-" + slot, cur, opts)
      );
    }
    largeEl.innerHTML = slotSelect("large", large);
    smallEl.innerHTML = slotSelect("small", small);
    bindWidgets(largeEl);
    bindWidgets(smallEl);
    function bindSlot(el, slot) {
      var box = el.querySelector(".cselect");
      if (!box) return;
      box.onchangeBound = function (ref) {
        var parsed = parseSlotRef(ref);
        if (!parsed) return;
        applyOp("setModelSlot", [slot, parsed], true).then(function () {
          renderSidebarSlots();
        });
      };
    }
    bindSlot(largeEl, "large");
    bindSlot(smallEl, "small");
  }

  function renderModels(list, doc) {
    var providers = entries(doc.providers);
    if (!providers.length) {
      list.innerHTML = emptyHtml(t("empty.detail"));
      return;
    }
    providers.forEach(function (p) {
      var models = (p.value.models || [])
        .map(function (m) {
          return m.id;
        })
        .join(", ");
      var badges =
        '<span class="badge">' +
        esc(p.value.type || "openai") +
        "</span>" +
        (p.value.disable ? '<span class="badge off">' + esc(t("badge.disabled")) + "</span>" : "");
      list.insertAdjacentHTML(
        "beforeend",
        cardHtml(p.id, p.value.name || p.id, models || t("models.none"), badges, state.selected === p.id),
      );
    });
    bindCards(list, function (id) {
      openProvider(id);
    });
  }

  function renderNamed(list, map, kind, subFn, disabledFn) {
    var named = entries(map);
    if (!named.length) {
      list.innerHTML = emptyHtml(t("empty.detail"));
      return;
    }
    named.forEach(function (item) {
      var badges = disabledFn(item.value) ? '<span class="badge off">' + esc(t("badge.disabled")) + "</span>" : "";
      list.insertAdjacentHTML(
        "beforeend",
        cardHtml(item.id, item.id, subFn(item.value), badges, state.selected === item.id),
      );
    });
    bindCards(list, function (id) {
      if (kind === "mcp") openMcp(id);
      else openLsp(id);
    });
  }

  function renderSkills(list) {
    var skills = (state.data && state.data.skills) || [];
    if (!skills.length) {
      list.innerHTML = emptyHtml(t("empty.skills"));
      return;
    }
    skills.forEach(function (s) {
      var badges =
        '<span class="badge">' +
        esc(s.source) +
        "</span>" +
        (s.disabled ? '<span class="badge off">' + esc(t("badge.disabled")) + "</span>" : "");
      list.insertAdjacentHTML(
        "beforeend",
        cardHtml(s.name, s.name, s.description || s.path, badges, state.selected === s.name),
      );
    });
    bindCards(list, function (id) {
      openSkill(id);
    });
  }

  function renderHooks(list, doc) {
    var events = Object.keys(doc.hooks || {});
    var count = 0;
    events.forEach(function (event) {
      count += (doc.hooks[event] || []).length;
    });
    if (!count) {
      list.innerHTML = emptyHtml(t("empty.detail"));
      return;
    }
    events.forEach(function (event) {
      (doc.hooks[event] || []).forEach(function (h, i) {
        var id = event + "::" + (h.name || String(i));
        list.insertAdjacentHTML(
          "beforeend",
          cardHtml(id, h.name || event + " #" + i, event + " · " + (h.command || ""), "", state.selected === id),
        );
      });
    });
    bindCards(list, function (id) {
      openHook(id);
    });
  }

  function renderPermissions(list, doc) {
    var allowed = (doc.permissions && doc.permissions.allowed_tools) || [];
    var denied = (doc.options && doc.options.disabled_tools) || [];
    if (!allowed.length && !denied.length) {
      list.innerHTML = emptyHtml(t("empty.detail"));
      return;
    }
    allowed.forEach(function (toolName) {
      list.insertAdjacentHTML("beforeend", cardHtml("allow:" + toolName, toolName, t("perm.allowSub"), '<span class="badge">' + esc(t("badge.allow")) + "</span>", state.selected === "allow:" + toolName));
    });
    denied.forEach(function (toolName) {
      list.insertAdjacentHTML("beforeend", cardHtml("deny:" + toolName, toolName, t("perm.denySub"), '<span class="badge off">' + esc(t("badge.deny")) + "</span>", state.selected === "deny:" + toolName));
    });
    bindCards(list, function (id) {
      openPermission(id);
    });
  }

  function renderOptionsSummary(list, doc) {
    list.insertAdjacentHTML(
      "beforeend",
      cardHtml("options", t("options.cardTitle"), t("options.cardSub"), "", state.modalOpen && state.selected === "options"),
    );
    bindCards(list, function () {
      openOptions();
    });
    void doc;
  }

  function renderEnv(list, doc) {
    Object.keys(doc.env || {}).forEach(function (k) {
      list.insertAdjacentHTML("beforeend", cardHtml("env:" + k, k, String(doc.env[k]), '<span class="badge">' + esc(t("badge.env")) + "</span>", state.selected === "env:" + k));
    });
    list.insertAdjacentHTML(
      "beforeend",
      cardHtml("tools", t("tools.cardTitle"), JSON.stringify(doc.tools || {}), "", state.selected === "tools"),
    );
    bindCards(list, function (id) {
      if (id === "tools") openTools();
      else openEnv(id.slice(4));
    });
  }

  function bindCards(list, onSelect) {
    list.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function () {
        state.selected = card.getAttribute("data-id");
        list.querySelectorAll(".card").forEach(function (c) {
          c.classList.toggle("selected", c === card);
        });
        onSelect(state.selected);
      });
    });
  }

  function modalTitleText(create, edit) {
    return state.selected ? t(edit) : t(create);
  }

  function showForm(html, titleKey) {
    var overlay = $("modalOverlay");
    $("modalTitle").textContent = titleKey ? t(titleKey) : "";
    overlay.hidden = false;
    state.modalOpen = true;
    var form = $("form");
    form.innerHTML = html;
    var actions = form.querySelector(".form-actions");
    var body = document.createElement("div");
    body.className = "form-body";
    while (form.firstChild && form.firstChild !== actions) {
      body.appendChild(form.firstChild);
    }
    form.insertBefore(body, actions || null);
    bindWidgets(form);
    var first = form.querySelector("input:not([type=hidden]):not([type=checkbox]):not([readonly]), textarea:not([readonly])");
    if (first) {
      try {
        first.focus();
      } catch (err) {
        /* focus is best-effort */
      }
    }
  }

  function hideForm() {
    var overlay = $("modalOverlay");
    overlay.hidden = true;
    state.modalOpen = false;
    state.selected = null;
    state.editingModel = null;
    $("form").innerHTML = "";
    $("list")
      .querySelectorAll(".card.selected")
      .forEach(function (c) {
        c.classList.remove("selected");
      });
  }

  function formButtons(includeDelete, includeToggle, toggled) {
    var html = '<div class="form-actions">';
    if (includeDelete) html += '<button type="button" class="danger" id="deleteBtn">' + esc(t("btn.delete")) + "</button>";
    html += '<span class="spacer"></span>';
    if (includeToggle) {
      html +=
        '<button type="button" class="ghost" id="toggleBtn">' +
        esc(toggled ? t("btn.enable") : t("btn.disable")) +
        "</button>";
    }
    html += '<button type="submit" class="primary">' + esc(t("btn.apply")) + "</button>";
    html += "</div>";
    return html;
  }

  function providerPayload() {
    var extraBody = val("extra_body");
    var payload = {
      id: String(val("id") || "").trim(),
      name: val("name"),
      type: val("type"),
      base_url: val("base_url"),
      api_key: val("api_key"),
      system_prompt_prefix: val("system_prompt_prefix"),
      disable: val("disable"),
      flat_rate: val("flat_rate"),
      discover_models: val("discover_models"),
      extra_headers: parseKV(val("extra_headers")),
    };
    if (extraBody && String(extraBody).trim()) {
      payload.extra_body = JSON.parse(extraBody);
    }
    return payload;
  }

  function saveProvider() {
    clearFieldErrors();
    var payload;
    try {
      payload = providerPayload();
    } catch (err) {
      setFieldError("extra_body", t("err.extraBodyJson"));
      return Promise.resolve(null);
    }
    if (!payload.id) {
      setFieldError("id", t("model.needProvider"));
      return Promise.resolve(null);
    }
    return applyOp("upsertProvider", [payload], true).then(function () {
      return payload.id;
    });
  }

  function currentProviderModels(pid) {
    var p = state.data && state.data.document && state.data.document.providers
      ? state.data.document.providers[pid]
      : null;
    return (p && p.models) || [];
  }

  function modelRowHtml(m, editing) {
    var extra = "";
    if (editing) {
      extra =
        '<div class="model-edit">' +
        '<div class="row">' +
        field("edit_name", t("field.modelName"), m.name || m.id, "text", { spellcheck: false }) +
        field("edit_ctx", t("field.contextWindow"), m.context_window || "", "number") +
        "</div>" +
        '<div class="row">' +
        field("edit_max", t("field.defaultMaxTokens"), m.default_max_tokens || "", "number") +
        field("edit_price_in", t("field.priceIn"), m.cost_per_1m_in || "", "number") +
        "</div>" +
        '<div class="row">' +
        field("edit_reason", t("field.canReason"), m.can_reason, "checkbox") +
        field("edit_images", t("field.supportsImages"), m.supports_attachments, "checkbox") +
        "</div>" +
        '<div class="discover-row">' +
        '<button type="button" class="primary small model-save">' +
        esc(t("btn.apply")) +
        "</button>" +
        '<button type="button" class="ghost small model-cancel">' +
        esc(t("btn.cancel")) +
        "</button></div></div>";
    }
    return (
      '<div class="model-chip' +
      (editing ? " is-editing" : "") +
      '" data-model-id="' +
      esc(m.id) +
      '"><div class="model-chip-main"><span><strong>' +
      esc(m.id) +
      "</strong>" +
      (!editing && m.name && m.name !== m.id ? " · " + esc(m.name) : "") +
      '</span><div class="model-chip-actions">' +
      '<button type="button" class="ghost small model-edit-btn">' +
      esc(t("btn.edit")) +
      "</button>" +
      '<button type="button" class="danger small model-remove">' +
      esc(t("btn.delete")) +
      "</button></div></div>" +
      extra +
      "</div>"
    );
  }

  function paintModelEditor(pid) {
    var box = $("modelEditor");
    if (!box) return;
    var registered = currentProviderModels(pid);
    var discovered = state.discovered[pid] || [];
    var have = {};
    registered.forEach(function (m) {
      have[m.id] = true;
    });
    var available = discovered.filter(function (m) {
      return m.id && !have[m.id];
    });
    var listHtml = registered.length
      ? registered.map(function (m) {
          return modelRowHtml(m, state.editingModel === m.id);
        }).join("")
      : '<div class="hint">' + esc(t("model.empty")) + "</div>";
    var availHtml = "";
    if (available.length) {
      availHtml =
        '<div class="avail-head">' +
        esc(t("discover.available", { n: available.length })) +
        ' <button type="button" class="ghost small" id="importAllBtn">' +
        esc(t("discover.importAll")) +
        '</button></div><div class="model-list avail-list">';
      available.forEach(function (m) {
        availHtml +=
          '<div class="model-chip" data-avail-id="' +
          esc(m.id) +
          '"><span><strong>' +
          esc(m.id) +
          "</strong>" +
          (m.name && m.name !== m.id ? " · " + esc(m.name) : "") +
          '</span><button type="button" class="primary small model-import">' +
          esc(t("model.add")) +
          "</button></div>";
      });
      availHtml += "</div>";
    }
    box.innerHTML =
      '<div class="model-toolbar">' +
      '<button type="button" class="ghost" id="fetchModelsBtn">' +
      esc(t("discover.fetch")) +
      "</button>" +
      '<span id="fetchModelsStatus" class="hint"></span></div>' +
      '<div class="hint">' +
      esc(t("hint.discover")) +
      "</div>" +
      '<div class="model-list" id="registeredModels">' +
      listHtml +
      "</div>" +
      availHtml +
      '<div class="manual-add">' +
      '<label class="field-label" for="f-model_id">' +
      esc(t("form.manualModel")) +
      "</label>" +
      '<div class="manual-add-row">' +
      '<input id="f-model_id" name="model_id" type="text" spellcheck="false" autocomplete="off" placeholder="' +
      esc(t("field.modelId")) +
      '" />' +
      '<input id="f-model_name" name="model_name" type="text" spellcheck="false" placeholder="' +
      esc(t("field.modelName")) +
      '" />' +
      '<button type="button" class="primary" id="addModelBtn">' +
      esc(t("model.add")) +
      "</button></div>" +
      '<div class="hint">' +
      esc(t("hint.model_id")) +
      "</div></div>";
    bindModelEditor(pid);
  }

  function persistModel(pid, partial) {
    return applyOp("upsertModel", [pid, partial], true);
  }

  function bindModelEditor(pid) {
    var fetchBtn = $("fetchModelsBtn");
    var status = $("fetchModelsStatus");
    if (fetchBtn) {
      fetchBtn.onclick = function () {
        if (!api || !api.discoverModels) {
          showStatus(t("err.noHost"), "error");
          return;
        }
        fetchBtn.disabled = true;
        if (status) status.textContent = t("discover.loading");
        saveProvider()
          .then(function (savedId) {
            if (!savedId) return null;
            pid = savedId;
            return api.discoverModels({
              providerId: savedId,
              type: val("type"),
              baseUrl: val("base_url"),
              apiKey: val("api_key"),
              extraHeaders: parseKV(val("extra_headers")),
            });
          })
          .then(function (res) {
            if (!res) return;
            if (!res.ok) throw new Error(res.error || t("discover.fail"));
            state.discovered[pid] = res.models || [];
            if (status) status.textContent = t("discover.ok", { n: (res.models || []).length });
            paintModelEditor(pid);
            var again = $("fetchModelsStatus");
            if (again) again.textContent = t("discover.ok", { n: (res.models || []).length });
          })
          .catch(function (err) {
            if (status) status.textContent = err.message || t("discover.fail");
            showStatus(err.message || t("discover.fail"), "error");
          })
          .then(function () {
            if ($("fetchModelsBtn")) $("fetchModelsBtn").disabled = false;
          });
      };
    }
    if ($("addModelBtn")) {
      $("addModelBtn").onclick = function () {
        var mid = String(val("model_id") || "").trim();
        if (!mid) {
          setFieldError("model_id", t("model.needId"));
          return;
        }
        var name = String(val("model_name") || "").trim() || mid;
        saveProvider()
          .then(function (savedId) {
            if (!savedId) return;
            pid = savedId;
            return persistModel(pid, { id: mid, name: name }).then(function () {
              showStatus(t("model.added", { id: mid }), "ok");
              state.editingModel = null;
              paintModelEditor(pid);
              renderSidebarSlots();
              renderListKeepForm();
            });
          })
          .catch(function (err) {
            showStatus(err.message || String(err), "error");
          });
      };
    }
    document.querySelectorAll(".model-remove").forEach(function (rm) {
      rm.onclick = function () {
        var chip = rm.closest("[data-model-id]");
        var mid = chip && chip.getAttribute("data-model-id");
        if (!mid || !pid) return;
        applyOp("removeModel", [pid, mid], true).then(function () {
          if (state.editingModel === mid) state.editingModel = null;
          paintModelEditor(pid);
          renderSidebarSlots();
          renderListKeepForm();
        });
      };
    });
    document.querySelectorAll(".model-edit-btn").forEach(function (btn) {
      btn.onclick = function () {
        var chip = btn.closest("[data-model-id]");
        var mid = chip && chip.getAttribute("data-model-id");
        state.editingModel = state.editingModel === mid ? null : mid;
        paintModelEditor(pid);
      };
    });
    document.querySelectorAll(".model-cancel").forEach(function (btn) {
      btn.onclick = function () {
        state.editingModel = null;
        paintModelEditor(pid);
      };
    });
    document.querySelectorAll(".model-save").forEach(function (btn) {
      btn.onclick = function () {
        var chip = btn.closest("[data-model-id]");
        var mid = chip && chip.getAttribute("data-model-id");
        if (!mid) return;
        persistModel(pid, {
          id: mid,
          name: val("edit_name") || mid,
          context_window: Number(val("edit_ctx") || 0),
          default_max_tokens: Number(val("edit_max") || 0),
          can_reason: val("edit_reason"),
          supports_attachments: val("edit_images"),
          cost_per_1m_in: Number(val("edit_price_in") || 0),
        }).then(function () {
          state.editingModel = null;
          showStatus(t("model.updated", { id: mid }), "ok");
          paintModelEditor(pid);
          renderSidebarSlots();
        });
      };
    });
    document.querySelectorAll(".model-import").forEach(function (btn) {
      btn.onclick = function () {
        var chip = btn.closest("[data-avail-id]");
        var mid = chip && chip.getAttribute("data-avail-id");
        if (!mid || !pid) return;
        var found = (state.discovered[pid] || []).find(function (m) {
          return m.id === mid;
        });
        persistModel(pid, { id: mid, name: (found && found.name) || mid }).then(function () {
          showStatus(t("model.added", { id: mid }), "ok");
          paintModelEditor(pid);
          renderSidebarSlots();
          renderListKeepForm();
        });
      };
    });
    if ($("importAllBtn")) {
      $("importAllBtn").onclick = function () {
        var avail = (state.discovered[pid] || []).filter(function (m) {
          return m.id && !currentProviderModels(pid).some(function (r) {
            return r.id === m.id;
          });
        });
        var chain = Promise.resolve();
        avail.forEach(function (m) {
          chain = chain.then(function () {
            return persistModel(pid, { id: m.id, name: m.name || m.id });
          });
        });
        chain.then(function () {
          showStatus(t("discover.imported", { n: avail.length }), "ok");
          paintModelEditor(pid);
          renderSidebarSlots();
          renderListKeepForm();
        });
      };
    }
  }

  function renderListKeepForm() {
    renderList();
  }

  function openProvider(id) {
    var p = (state.data.document.providers || {})[id] || {};
    state.editingModel = null;
    showForm(
      formSection(
        "form.section.identity",
        field("id", t("field.id"), id, "text", { required: true, spellcheck: false, autocomplete: "off" }) +
          field("name", t("field.name"), p.name, "text", { spellcheck: false }) +
          field("type", t("field.type"), p.type || "openai", "select", { options: PROVIDER_TYPES }),
      ) +
        formSection(
          "form.section.connection",
          field("base_url", t("field.baseUrl"), p.base_url, "text", { spellcheck: false, autocomplete: "off" }) +
            field("api_key", t("field.apiKey"), p.api_key, "secret"),
        ) +
        formSection(
          "form.section.flags",
          '<div class="row">' +
            field("disable", t("field.disabled"), p.disable, "checkbox") +
            field("flat_rate", t("field.flatRate"), p.flat_rate, "checkbox") +
            "</div>" +
            field("discover_models", t("field.discoverModels"), p.discover_models !== false, "checkbox"),
        ) +
        formSection(
          "form.section.advanced",
          field("system_prompt_prefix", t("field.systemPromptPrefix"), p.system_prompt_prefix) +
            field("extra_headers", t("field.extraHeaders"), kvText(p.extra_headers), "textarea", { spellcheck: false }) +
            field("extra_body", t("field.extraBody"), p.extra_body ? JSON.stringify(p.extra_body, null, 2) : "", "textarea", {
              spellcheck: false,
            }),
        ) +
        formSection("form.customModels", '<div id="modelEditor"></div>') +
        formButtons(true, true, p.disable),
      modalTitleText("form.providerNew", "form.provider"),
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      saveProvider()
        .then(function (pid) {
          if (!pid) return;
          state.selected = pid;
          hideForm();
        })
        .catch(function (err) {
          showStatus(err.message || String(err), "error");
        });
    };
    wireToggleDelete(
      function () {
        return applyOp("setProviderDisabled", [id, !p.disable]);
      },
      function () {
        return applyOp("removeProvider", [id]);
      },
    );
    paintModelEditor(id || "");
  }

  function syncMcpTransport() {
    var type = val("type") || "stdio";
    var stdio = type === "stdio";
    var stdioBox = $("mcp-stdio");
    var httpBox = $("mcp-http");
    if (stdioBox) stdioBox.hidden = !stdio;
    if (httpBox) httpBox.hidden = stdio;
  }

  function syncMcpOauth() {
    var box = $("mcp-oauth-fields");
    if (box) box.hidden = !val("oauth");
  }

  function openMcp(id) {
    var m = ((state.data.document.mcp || {})[id]) || {};
    var transport = m.type || "stdio";
    showForm(
      formSection(
        "form.section.identity",
        field("name", t("field.name"), id, "text", { required: true, spellcheck: false, autocomplete: "off" }) +
          field("type", t("field.transport"), transport, "select", {
            options: ["stdio", "http", "sse"],
            hint: t("hint.transport"),
          }) +
          field("disabled", t("field.disabled"), m.disabled, "checkbox") +
          field("timeout", t("field.timeout"), m.timeout || "", "number"),
      ) +
        formSection(
          "form.section.command",
          field("command", t("field.command"), m.command, "text", { spellcheck: false }) +
            field("args", t("field.args"), (m.args || []).join("\n"), "textarea", { spellcheck: false }) +
            field("env", t("field.envKv"), kvText(m.env), "textarea", { spellcheck: false }),
          { id: "mcp-stdio", hidden: transport !== "stdio" },
        ) +
        formSection(
          "form.section.http",
          field("url", t("field.url"), m.url, "text", { spellcheck: false }) +
            field("headers", t("field.headers"), kvText(m.headers), "textarea", { spellcheck: false }),
          { id: "mcp-http", hidden: transport === "stdio" },
        ) +
        formSection(
          "form.section.tools",
          field("disabled_tools", t("field.disabledTools"), (m.disabled_tools || []).join("\n"), "textarea", { spellcheck: false }) +
            field("enabled_tools", t("field.enabledTools"), (m.enabled_tools || []).join("\n"), "textarea", { spellcheck: false }),
        ) +
        formSection(
          "form.section.auth",
          field("oauth", t("field.oauth"), m.oauth, "checkbox") +
            '<div id="mcp-oauth-fields"' +
            (m.oauth ? "" : " hidden") +
            ">" +
            field("oauth_client_id", t("field.oauthClientId"), m.oauth_client_id, "text", { spellcheck: false }) +
            field("oauth_client_secret", t("field.oauthClientSecret"), m.oauth_client_secret, "secret") +
            field("oauth_callback_port", t("field.oauthCallbackPort"), m.oauth_callback_port || "", "number") +
            "</div>",
        ) +
        formButtons(true, true, m.disabled),
      modalTitleText("form.mcpNew", "form.mcp"),
    );
    var typeBox = document.querySelector('#form .cselect[data-name="type"]');
    if (typeBox) typeBox.onchangeBound = syncMcpTransport;
    var oauth = $("f-oauth");
    if (oauth) oauth.addEventListener("change", syncMcpOauth);
    syncMcpTransport();
    syncMcpOauth();
    $("form").onsubmit = function (e) {
      e.preventDefault();
      clearFieldErrors();
      var name = val("name");
      if (!String(name || "").trim()) {
        setFieldError("name", t("field.required"));
        return;
      }
      var server = {
        type: val("type"),
        command: val("command"),
        args: parseLines(val("args")),
        env: parseKV(val("env")),
        url: val("url"),
        headers: parseKV(val("headers")),
        timeout: val("timeout") ? Number(val("timeout")) : undefined,
        disabled: val("disabled"),
        disabled_tools: parseLines(val("disabled_tools")),
        enabled_tools: parseLines(val("enabled_tools")),
        oauth: val("oauth"),
        oauth_client_id: val("oauth_client_id"),
        oauth_client_secret: val("oauth_client_secret"),
        oauth_callback_port: val("oauth_callback_port") ? Number(val("oauth_callback_port")) : undefined,
      };
      Promise.resolve(applyOp("upsertMcp", [name, server], true)).then(function () {
        hideForm();
      });
    };
    wireToggleDelete(
      function () {
        return applyOp("setMcpDisabled", [id, !m.disabled]);
      },
      function () {
        return applyOp("removeMcp", [id]);
      },
    );
  }

  function openLsp(id) {
    var l = ((state.data.document.lsp || {})[id]) || {};
    showForm(
      formSection(
        "form.section.identity",
        field("name", t("field.name"), id, "text", { required: true, spellcheck: false }) +
          field("disabled", t("field.disabled"), l.disabled, "checkbox") +
          field("timeout", t("field.timeout"), l.timeout || "", "number"),
      ) +
        formSection(
          "form.section.command",
          field("command", t("field.command"), l.command, "text", { spellcheck: false }) +
            field("args", t("field.args"), (l.args || []).join("\n"), "textarea", { spellcheck: false }) +
            field("env", t("field.envKv"), kvText(l.env), "textarea", { spellcheck: false }),
        ) +
        formSection(
          "form.section.lsp",
          field("filetypes", t("field.filetypes"), (l.filetypes || []).join("\n"), "textarea", { spellcheck: false }) +
            field("root_markers", t("field.rootMarkers"), (l.root_markers || []).join("\n"), "textarea", { spellcheck: false }),
        ) +
        formSection(
          "form.section.advanced",
          field("init_options", t("field.initOptions"), l.init_options ? JSON.stringify(l.init_options, null, 2) : "", "textarea", {
            spellcheck: false,
          }) +
            field("options", t("field.optionsJson"), l.options ? JSON.stringify(l.options, null, 2) : "", "textarea", {
              spellcheck: false,
            }),
        ) +
        formButtons(true, true, l.disabled),
      modalTitleText("form.lspNew", "form.lsp"),
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      clearFieldErrors();
      if (!String(val("name") || "").trim()) {
        setFieldError("name", t("field.required"));
        return;
      }
      var inito = val("init_options");
      var opt = val("options");
      var server = {
        command: val("command"),
        args: parseLines(val("args")),
        env: parseKV(val("env")),
        filetypes: parseLines(val("filetypes")),
        root_markers: parseLines(val("root_markers")),
        timeout: val("timeout") ? Number(val("timeout")) : undefined,
        disabled: val("disabled"),
      };
      try {
        if (inito.trim()) server.init_options = JSON.parse(inito);
      } catch (err) {
        setFieldError("init_options", t("err.json"));
        return;
      }
      try {
        if (opt.trim()) server.options = JSON.parse(opt);
      } catch (err) {
        setFieldError("options", t("err.json"));
        return;
      }
      Promise.resolve(applyOp("upsertLsp", [val("name"), server], true)).then(function () {
        hideForm();
      });
    };
    wireToggleDelete(
      function () {
        return applyOp("setLspDisabled", [id, !l.disabled]);
      },
      function () {
        return applyOp("removeLsp", [id]);
      },
    );
  }

  function openHook(id) {
    var parts = id.split("::");
    var event = parts[0];
    var name = parts.slice(1).join("::");
    var hooks = ((state.data.document.hooks || {})[event] || []).filter(function (h) {
      return (h.name || "") === name || id.endsWith("::" + name);
    });
    var h = hooks[0] || { event: event, name: name };
    showForm(
      formSection(
        "form.section.identity",
        field("event", t("field.event"), event, "select", { options: ["PreToolUse"] }) +
          field("name", t("field.name"), h.name || "", "text", { required: true, spellcheck: false }) +
          field("timeout", t("field.timeout"), h.timeout || 30, "number"),
      ) +
        formSection(
          "form.section.command",
          field("command", t("field.command"), h.command || "", "text", { spellcheck: false }) +
            field("matcher", t("field.matcher"), h.matcher || "", "text", { spellcheck: false }),
        ) +
        formButtons(true, false),
      "form.hook",
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      clearFieldErrors();
      var ev = val("event");
      var nm = val("name");
      if (!String(nm || "").trim()) {
        setFieldError("name", t("field.required"));
        return;
      }
      var chain = Promise.resolve();
      if (h.name) chain = applyOp("removeHook", [event, h.name], true);
      chain.then(function () {
        return applyOp("addHook", [
          ev,
          { name: nm, command: val("command"), matcher: val("matcher"), timeout: Number(val("timeout") || 30) },
        ], true);
      }).then(function () {
        hideForm();
      });
    };
    wireToggleDelete(null, function () {
      return applyOp("removeHook", [event, h.name]);
    });
  }

  function openSkill(name) {
    var skill = ((state.data.skills || []).filter(function (s) {
      return s.name === name;
    })[0]) || { name: name };
    showForm(
      formSection(
        "form.section.identity",
        field("name", t("field.name"), skill.name, "text", { readonly: true }) +
          field("description", t("field.description"), skill.description || "", "textarea", { readonly: true }) +
          field("source", t("field.source"), skill.source || "", "text", { readonly: true }) +
          field("path", t("field.path"), skill.path || "", "text", { readonly: true }) +
          field("disabled", t("field.disabled"), skill.disabled, "checkbox"),
      ) +
        '<div class="form-actions"><span class="spacer"></span><button type="submit" class="primary">' +
        esc(skill.disabled ? t("btn.enable") : t("btn.disable")) +
        "</button></div>",
      "form.skill",
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      Promise.resolve(applyOp("setSkillDisabled", [skill.name, !skill.disabled], true)).then(function () {
        hideForm();
      });
    };
  }

  function openPermission(id) {
    var kind = id.startsWith("allow:") ? "allow" : "deny";
    var tool = id.slice(kind.length + 1);
    showForm(
      formSection(
        "form.section.identity",
        field("tool", t("field.tool"), tool, "text", { spellcheck: false, readonly: true }) +
          field("kind", t("field.kind"), kind, "select", {
            options: [
              { value: "allow", label: t("badge.allow") },
              { value: "deny", label: t("badge.deny") },
            ],
          }),
      ) +
        formButtons(true, false),
      "form.permission",
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      showStatus(t("status.permHint"), "ok");
    };
    wireToggleDelete(null, function () {
      if (kind === "allow") return applyOp("removeAllowedTool", [tool]);
      return applyOp("removeDeniedTool", [tool]);
    });
  }

  function openOptions() {
    var o = state.data.document.options || {};
    var tui = o.tui || {};
    var attr = o.attribution || {};
    showForm(
      formSection(
        "form.section.behavior",
        '<div class="row">' +
          field("debug", "debug", o.debug, "checkbox") +
          field("debug_lsp", "debug-lsp", o.debug_lsp, "checkbox") +
          "</div>" +
          '<div class="row">' +
          field("auto_lsp", "auto-lsp", o.auto_lsp !== false, "checkbox") +
          field("progress", "progress", o.progress !== false, "checkbox") +
          "</div>" +
          '<div class="row">' +
          field("metrics", "metrics", !o.disable_metrics, "checkbox") +
          field("auto_summarize", "auto-summarize", !o.disable_auto_summarize, "checkbox") +
          "</div>" +
          '<div class="row">' +
          field("provider_auto_update", "provider-auto-update", !o.disable_provider_auto_update, "checkbox") +
          field("default_providers", "default-providers", !o.disable_default_providers, "checkbox") +
          "</div>" +
          field("data_directory", "data-directory", o.data_directory || "", "text", { spellcheck: false }) +
          field("initialize_as", "initialize-as", o.initialize_as || "AGENTS.md", "select", {
            options: (function () {
              var opts = ["AGENTS.md", "CRUSH.md", "CLAUDE.md", "GEMINI.md", "docs/LLMs.md"];
              if (o.initialize_as && opts.indexOf(o.initialize_as) < 0) opts.unshift(o.initialize_as);
              return opts;
            })(),
          }) +
          field("notifications", "notifications", o.notifications || "auto", "select", {
            options: ["auto", "native", "osc", "bell", "disabled"],
          }),
      ) +
        formSection(
          "form.section.attribution",
          field("generated_with", "attribution-generated-with", attr.generated_with !== false, "checkbox") +
            field("trailer", "attribution-trailer-style", attr.trailer_style || "assisted-by", "select", {
              options: ["none", "co-authored-by", "assisted-by"],
            }),
        ) +
        formSection(
          "form.section.paths",
          field("context_paths", t("field.contextPaths"), (o.context_paths || []).join("\n"), "textarea", { spellcheck: false }) +
            field("global_context_paths", t("field.globalContextPaths"), (o.global_context_paths || []).join("\n"), "textarea", {
              spellcheck: false,
            }) +
            field("skills_paths", t("field.skillPaths"), (o.skills_paths || []).join("\n"), "textarea", { spellcheck: false }) +
            field("disabled_skills", t("field.disableSkill"), (o.disabled_skills || []).join("\n"), "textarea", { spellcheck: false }),
        ) +
        formSection(
          "form.optionUi",
          '<div class="row">' +
            field("compact", "compact", tui.compact_mode, "checkbox") +
            field("transparent", "transparent", tui.transparent, "checkbox") +
            "</div>" +
            field("diff", "diff", tui.diff_mode || "unified", "select", { options: ["unified", "split"] }) +
            field("scrollbar", "scrollbar", tui.scrollbar || "default", "select", { options: ["default", "always", "never"] }) +
            '<div class="row">' +
            field("max_depth", "completions-max-depth", (tui.completions && tui.completions.max_depth) || "", "number") +
            field("max_items", "completions-max-items", (tui.completions && tui.completions.max_items) || "", "number") +
            "</div>",
        ) +
        '<div class="form-actions"><span class="spacer"></span><button type="submit" class="primary">' +
        esc(t("btn.apply")) +
        "</button></div>",
      "form.options",
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      var chain = Promise.resolve();
      function set(key, value) {
        chain = chain.then(function () {
          return applyOp("setOption", [key, value], true);
        });
      }
      function setUi(key, value) {
        chain = chain.then(function () {
          return applyOp("setOptionUi", [key, value], true);
        });
      }
      set("debug", val("debug"));
      set("debug-lsp", val("debug_lsp"));
      set("auto-lsp", val("auto_lsp"));
      set("progress", val("progress"));
      set("metrics", val("metrics"));
      set("auto-summarize", val("auto_summarize"));
      set("provider-auto-update", val("provider_auto_update"));
      set("default-providers", val("default_providers"));
      if (val("data_directory")) set("data-directory", val("data_directory"));
      if (val("initialize_as")) set("initialize-as", val("initialize_as"));
      set("notifications", val("notifications"));
      set("attribution-generated-with", val("generated_with"));
      set("attribution-trailer-style", val("trailer"));
      chain = chain.then(function () {
        return applyOp("resetOptionList", ["context-path"], true);
      });
      parseLines(val("context_paths")).forEach(function (p) {
        set("context-path", p);
      });
      chain = chain.then(function () {
        return applyOp("resetOptionList", ["global-context-path"], true);
      });
      parseLines(val("global_context_paths")).forEach(function (p) {
        set("global-context-path", p);
      });
      chain = chain.then(function () {
        return applyOp("resetOptionList", ["skill-path"], true);
      });
      parseLines(val("skills_paths")).forEach(function (p) {
        set("skill-path", p);
      });
      chain = chain.then(function () {
        return applyOp("resetOptionList", ["disable-skill"], true);
      });
      parseLines(val("disabled_skills")).forEach(function (p) {
        set("disable-skill", p);
      });
      setUi("compact", val("compact"));
      setUi("transparent", val("transparent"));
      setUi("diff", val("diff"));
      setUi("scrollbar", val("scrollbar"));
      if (val("max_depth") !== "") setUi("completions-max-depth", Number(val("max_depth")));
      if (val("max_items") !== "") setUi("completions-max-items", Number(val("max_items")));
      chain.then(function () {
        return refresh();
      }).then(function () {
        hideForm();
      });
    };
  }

  function openEnv(key) {
    var value = state.data.document.env[key] || "";
    showForm(
      formSection(
        "form.section.identity",
        field("key", t("field.key"), key, "text", { required: true, spellcheck: false, autocomplete: "off" }) +
          field("value", t("field.value"), value, "text", { spellcheck: false }),
      ) +
        formButtons(true, false),
      "form.env",
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      Promise.resolve(applyOp("setEnv", [val("key"), val("value")], true)).then(function () {
        hideForm();
      });
    };
    wireToggleDelete(null, function () {
      return applyOp("removeEnv", [key]);
    });
  }

  function openTools() {
    var t = state.data.document.tools || {};
    showForm(
      formSection(
        "form.section.tools",
        '<div class="row">' +
          field("ls_depth", "ls max_depth", t.ls && t.ls.max_depth, "number") +
          field("ls_items", "ls max_items", t.ls && t.ls.max_items, "number") +
          "</div>" +
          '<div class="row">' +
          field("grep_timeout", "grep timeout", t.grep && t.grep.timeout, "number") +
          field("glob_timeout", "glob timeout", t.glob && t.glob.timeout, "number") +
          "</div>",
      ) +
        '<div class="form-actions"><span class="spacer"></span><button type="submit" class="primary">' +
        esc(t("btn.apply")) +
        "</button></div>",
      "form.tools",
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      Promise.resolve(
        applyOp("setTools", [
          {
            ls: { max_depth: Number(val("ls_depth") || 0), max_items: Number(val("ls_items") || 0) },
            grep: { timeout: Number(val("grep_timeout") || 0) },
            glob: { timeout: Number(val("glob_timeout") || 0) },
          },
        ], true),
      ).then(function () {
        hideForm();
      });
    };
  }

  function wireToggleDelete(onToggle, onDelete) {
    var t = $("toggleBtn");
    var d = $("deleteBtn");
    if (t && onToggle) t.onclick = onToggle;
    if (d && onDelete)
      d.onclick = function () {
        onDelete().then(function () {
          hideForm();
        });
      };
  }

  function applyOp(op, args, skipRefresh) {
    if (!api) {
      showStatus(t("err.noHost"), "error");
      return Promise.resolve();
    }
    return Promise.resolve(api.apply(op, args))
      .then(function (next) {
        if (next && next.error) throw new Error(next.error);
        if (next && next.document) state.data = next;
        if (next && next.lastWrite && next.lastWrite.path) {
          showStatus(t("status.saved", { path: next.lastWrite.path }), "ok");
        }
        if (!skipRefresh) return refresh(true);
      })
      .catch(function (err) {
        showStatus(err.message || String(err), "error");
      });
  }

  function crushMethodLabel(s) {
    return (s && (s.preferredLabel || s.preferred || s.method)) || "";
  }

  function renderCrushAgent() {
    var box = $("crushAgent");
    if (!box) return;
    var s = state.crush || {};
    var installing = Boolean(s.installing);
    var method = crushMethodLabel(s);
    var line;
    var sub;
    var btnLabel;
    var disabled = installing;
    var dotClass = "dot";
    if (installing) {
      line = t("crush.installing", { method: method || "…" });
      sub = t("crush.installWait");
      btnLabel = t("crush.installingBtn");
      dotClass += " busy";
    } else if (s.installed) {
      line = t("crush.ready", { version: s.version || t("crush.unknownVersion") });
      sub = s.path || "";
      btnLabel = method ? t("crush.update") : t("crush.recheck");
      disabled = false;
    } else if (s.pendingPath) {
      line = t("crush.missing");
      sub = t("crush.pending");
      btnLabel = t("crush.recheck");
      dotClass += " off";
    } else if (method) {
      line = t("crush.missing");
      sub = t("crush.via", { method: method });
      btnLabel = t("crush.install");
      dotClass += " off";
    } else {
      line = t("crush.missing");
      sub = t("crush.noInstaller");
      btnLabel = t("crush.recheck");
      dotClass += " off";
    }
    box.innerHTML =
      '<div class="crush-agent-title">' +
      esc(t("crush.title")) +
      '</div><div class="crush-agent-line"><span class="' +
      dotClass +
      '"></span><span>' +
      esc(line) +
      '</span></div><div class="crush-agent-sub">' +
      esc(sub) +
      '</div><button type="button" class="' +
      (s.installed || installing ? "ghost" : "primary") +
      ' small" id="installCrushBtn"' +
      (disabled ? " disabled" : "") +
      ">" +
      esc(btnLabel) +
      "</button>";
    var btn = $("installCrushBtn");
    if (btn) btn.onclick = onInstallCrush;
  }

  function refreshCrushAgent() {
    if (!api || !api.installStatus) {
      renderCrushAgent();
      return Promise.resolve();
    }
    return Promise.resolve(api.installStatus())
      .then(function (s) {
        var installing = state.crush && state.crush.installing;
        state.crush = Object.assign({}, s, { installing: installing });
        renderCrushAgent();
      })
      .catch(function () {
        renderCrushAgent();
      });
  }

  function onInstallCrush() {
    if (!api) {
      showStatus(t("err.noHost"), "error");
      return;
    }
    var s = state.crush || {};
    if (s.installing) return;
    if (!s.preferred && api.installStatus && !s.installed) {
      refreshCrushAgent();
      return;
    }
    if (!api.installCrush) {
      refreshCrushAgent();
      return;
    }
    if (!s.preferred && s.installed) {
      refreshCrushAgent();
      return;
    }
    state.crush = Object.assign({}, s, { installing: true });
    renderCrushAgent();
    Promise.resolve(api.installCrush({ method: s.preferred || undefined }))
      .then(function (res) {
        state.crush = Object.assign({}, res, { installing: false });
        if (res && res.ok && res.installed) {
          showStatus(t("crush.installOk", { version: res.version || t("crush.unknownVersion") }), "ok");
        } else if (res && res.ok && res.pendingPath) {
          showStatus(t("crush.pending"), "ok");
        } else if (res && res.busy) {
          showStatus(t("crush.busy"), "error");
        } else {
          showStatus((res && res.error) || t("crush.installFail"), "error");
        }
        renderCrushAgent();
      })
      .catch(function (err) {
        state.crush = Object.assign({}, state.crush, { installing: false });
        showStatus(err.message || t("crush.installFail"), "error");
        renderCrushAgent();
      });
  }

  function refresh(keepSelection) {
    if (!api) return Promise.resolve();
    return Promise.resolve(api.state())
      .then(function (s) {
        if (s && s.loaded) {
          state.data = s;
          renderList();
          if (!keepSelection) hideForm();
        }
      })
      .catch(function (err) {
        showStatus(err.message || String(err), "error");
      });
  }

  function doLoad() {
    if (!api) {
      showFileHint();
      renderList();
      return;
    }
    var projectDir = $("projectDir").value.trim();
    Promise.resolve(
      api.load({
        projectDir: projectDir || undefined,
        writeScope: state.scope,
      }),
    )
      .then(function (s) {
        if (s && s.error) throw new Error(s.error);
        state.data = s;
        showStatus(
          t("status.loaded", {
            n: (s.loadedPaths && s.loadedPaths.length) || 0,
            path: s.writeTarget && s.writeTarget.path ? s.writeTarget.path : "—",
          }),
          "ok",
        );
        renderList();
        hideForm();
      })
      .catch(function (err) {
        showStatus(err.message || String(err), "error");
      });
  }

  function doSave() {
    if (!api) return;
    Promise.resolve(api.save())
      .then(function (w) {
        if (w && w.error) throw new Error(w.error);
        showStatus(t("status.saved", { path: w && w.path ? w.path : "" }), "ok");
        return refresh(true);
      })
      .catch(function (err) {
        showStatus(err.message || String(err), "error");
      });
  }

  function onAdd() {
    if (state.section === "models") {
      state.selected = "";
      openProvider("");
    } else if (state.section === "mcp") {
      state.selected = "";
      openMcp("");
    } else if (state.section === "lsp") {
      state.selected = "";
      openLsp("");
    } else if (state.section === "hooks") {
      state.selected = "";
      openHook("PreToolUse::");
      $("form").onsubmit = function (e) {
        e.preventDefault();
        Promise.resolve(
          applyOp("addHook", [
            val("event"),
            { name: val("name"), command: val("command"), matcher: val("matcher"), timeout: Number(val("timeout") || 30) },
          ], true),
        ).then(function () {
          hideForm();
        });
      };
    } else if (state.section === "skills") {
      showForm(
        formSection(
          "form.section.paths",
          field("path", t("field.directory"), "", "text", { required: true, spellcheck: false }),
        ) +
          '<div class="form-actions"><span class="spacer"></span><button type="submit" class="primary">' +
          esc(t("btn.addPath")) +
          "</button></div>",
        "form.skillPath",
      );
      $("form").onsubmit = function (e) {
        e.preventDefault();
        clearFieldErrors();
        if (!String(val("path") || "").trim()) {
          setFieldError("path", t("field.required"));
          return;
        }
        Promise.resolve(applyOp("addSkillPath", [val("path")], true)).then(function () {
          hideForm();
        });
      };
    } else if (state.section === "permissions") {
      showForm(
        formSection(
          "form.section.identity",
          field("tool", t("field.tool"), "", "text", { required: true, spellcheck: false }) +
            field("kind", t("field.kind"), "allow", "select", {
              options: [
                { value: "allow", label: t("badge.allow") },
                { value: "deny", label: t("badge.deny") },
              ],
            }),
        ) +
          '<div class="form-actions"><span class="spacer"></span><button type="submit" class="primary">' +
          esc(t("btn.add")) +
          "</button></div>",
        "form.permissionNew",
      );
      $("form").onsubmit = function (e) {
        e.preventDefault();
        clearFieldErrors();
        if (!String(val("tool") || "").trim()) {
          setFieldError("tool", t("field.required"));
          return;
        }
        var op = val("kind") === "allow" ? "allowTool" : "denyTool";
        Promise.resolve(applyOp(op, [val("tool")], true)).then(function () {
          hideForm();
        });
      };
    } else if (state.section === "env") {
      showForm(
        formSection(
          "form.section.identity",
          field("key", t("field.key"), "", "text", { required: true, spellcheck: false, autocomplete: "off" }) +
            field("value", t("field.value"), "", "text", { spellcheck: false }),
        ) +
          '<div class="form-actions"><span class="spacer"></span><button type="submit" class="primary">' +
          esc(t("btn.add")) +
          "</button></div>",
        "form.envNew",
      );
      $("form").onsubmit = function (e) {
        e.preventDefault();
        clearFieldErrors();
        if (!String(val("key") || "").trim()) {
          setFieldError("key", t("field.required"));
          return;
        }
        Promise.resolve(applyOp("setEnv", [val("key"), val("value")], true)).then(function () {
          hideForm();
        });
      };
    }
  }

  function bindChrome() {
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        state.section = btn.getAttribute("data-section");
        state.selected = null;
        hideForm();
        renderList();
      });
    });
    document.querySelectorAll(".scope").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".scope").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        state.scope = btn.getAttribute("data-scope");
        doLoad();
      });
    });
    $("addBtn").addEventListener("click", onAdd);
    $("modalClose").addEventListener("click", hideForm);
    $("modalOverlay").addEventListener("mousedown", function (e) {
      if (e.target === $("modalOverlay")) hideForm();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !state.modalOpen) return;
      if (document.querySelector(".cselect.open")) return;
      hideForm();
    });
    $("saveBtn").addEventListener("click", doSave);
    $("reloadBtn").addEventListener("click", function () {
      if (!api) return doLoad();
      Promise.resolve(api.reload())
        .then(function (s) {
          state.data = s;
          showStatus(t("status.reloaded"), "ok");
          renderList();
        })
        .catch(function (err) {
          showStatus(err.message || String(err), "error");
        });
    });
    $("browseProject").addEventListener("click", function () {
      if (api && api.pickDirectory) {
        Promise.resolve(api.pickDirectory()).then(function (dir) {
          if (dir) {
            $("projectDir").value = dir;
            doLoad();
          }
        });
      }
    });
    $("projectDir").addEventListener("change", doLoad);
    if (api && api.window) {
      document.body.classList.add("is-desktop");
      var controls = document.querySelector(".win-controls");
      if (controls) controls.hidden = false;
      if ($("winMin")) $("winMin").onclick = function () { api.window.minimize(); };
      if ($("winMax")) $("winMax").onclick = function () { api.window.maximize(); };
      if ($("winClose")) $("winClose").onclick = function () { api.window.close(); };
    }
    document.querySelectorAll("[data-lang]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (window.crushI18n) window.crushI18n.setLang(btn.getAttribute("data-lang"));
        applyLocale();
      });
    });
  }

  function applyLocale() {
    if (window.crushI18n) window.crushI18n.applyStatic();
    showFileHint();
    renderCrushAgent();
    renderList();
    if (!state.modalOpen || !state.selected || !state.data || !state.data.document) return;
    if (state.section === "models") openProvider(state.selected);
    else if (state.section === "mcp") openMcp(state.selected);
    else if (state.section === "lsp") openLsp(state.selected);
    else if (state.section === "hooks") openHook(state.selected);
    else if (state.section === "skills") openSkill(state.selected);
    else if (state.section === "permissions") openPermission(state.selected);
    else if (state.section === "options") openOptions();
    else if (state.section === "env") {
      if (state.selected === "tools") openTools();
      else if (state.selected.indexOf("env:") === 0) openEnv(state.selected.slice(4));
    }
  }

  if (window.crushI18n) window.crushI18n.init();
  bindChrome();
  showFileHint();
  renderList();
  renderCrushAgent();
  if (api) doLoad();
  refreshCrushAgent();
})();
