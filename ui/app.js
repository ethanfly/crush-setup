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

  function customSelectHtml(name, value, options, extraClass) {
    var items = optionItems(options);
    var current = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].value === String(value == null ? "" : value)) current = items[i];
    }
    if (!current) current = items[0] || { value: "", label: "—" };
    var lis = items
      .map(function (item) {
        return (
          '<li role="option" data-value="' +
          esc(item.value) +
          '"' +
          (item.value === current.value ? ' class="is-on"' : "") +
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
      '<button type="button" class="cselect-btn" aria-haspopup="listbox">' +
      '<span class="cselect-value">' +
      esc(current.label) +
      "</span><span class=\"cselect-caret\"></span></button>" +
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
    return text ? '<div class="hint">' + esc(text) + "</div>" : "";
  }

  function field(name, label, value, type, extra) {
    extra = extra || {};
    var id = "f-" + name;
    var note = hintHtml(name, extra);
    if (type === "select") {
      return (
        '<div class="field"><label>' +
        esc(label) +
        "</label>" +
        customSelectHtml(name, value, extra.options) +
        note +
        "</div>"
      );
    }
    if (type === "textarea") {
      return (
        '<div class="field"><label for="' +
        id +
        '">' +
        esc(label) +
        '</label><textarea id="' +
        id +
        '" name="' +
        esc(name) +
        '">' +
        esc(value || "") +
        "</textarea>" +
        note +
        "</div>"
      );
    }
    if (type === "checkbox") {
      return (
        '<div class="field"><label class="switch-field">' +
        '<input type="checkbox" id="' +
        id +
        '" name="' +
        esc(name) +
        '"' +
        (value ? " checked" : "") +
        " />" +
        '<span class="switch-track"></span>' +
        '<span class="switch-label">' +
        esc(label) +
        "</span></label>" +
        note +
        "</div>"
      );
    }
    return (
      '<div class="field"><label for="' +
      id +
      '">' +
      esc(label) +
      '</label><input id="' +
      id +
      '" name="' +
      esc(name) +
      '" type="' +
      (type || "text") +
      '" value="' +
      esc(value == null ? "" : value) +
      '" />' +
      note +
      "</div>"
    );
  }

  function bindWidgets(root) {
    if (!root) return;
    root.querySelectorAll(".cselect").forEach(function (box) {
      if (box.getAttribute("data-bound")) return;
      box.setAttribute("data-bound", "1");
      var btn = box.querySelector(".cselect-btn");
      var menu = box.querySelector(".cselect-menu");
      var hidden = box.querySelector("input[type=hidden]");
      var labelEl = box.querySelector(".cselect-value");
      function close() {
        box.classList.remove("open");
        if (menu) menu.hidden = true;
      }
      function open() {
        document.querySelectorAll(".cselect.open").forEach(function (other) {
          if (other !== box) {
            other.classList.remove("open");
            var m = other.querySelector(".cselect-menu");
            if (m) m.hidden = true;
          }
        });
        box.classList.add("open");
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
        }
      }
      if (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (box.classList.contains("open")) close();
          else open();
        });
      }
      if (menu) {
        menu.querySelectorAll("li").forEach(function (li) {
          li.addEventListener("click", function (e) {
            e.stopPropagation();
            var value = li.getAttribute("data-value");
            if (hidden) hidden.value = value;
            if (labelEl) labelEl.textContent = li.textContent;
            menu.querySelectorAll("li").forEach(function (item) {
              item.classList.toggle("is-on", item === li);
            });
            close();
            if (typeof box.onchangeBound === "function") box.onchangeBound(value);
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
      list.innerHTML = '<div class="empty">' + esc(t("empty.load")) + "</div>";
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

  function renderSidebarSlots() {
    var largeEl = $("slotLarge");
    var smallEl = $("slotSmall");
    if (!largeEl || !smallEl) return;
    var doc = state.data && state.data.document;
    var large = doc && doc.models && doc.models.large;
    var small = doc && doc.models && doc.models.small;
    var choices = doc ? modelChoices(doc) : [];
    function slotSelect(slot, sel) {
      var cur = sel ? sel.provider + "/" + sel.model : "";
      var opts = [{ value: "", label: "—" }].concat(
        choices.map(function (c) {
          return { value: c, label: c };
        }),
      );
      return (
        '<label>' +
        esc(t(slot === "small" ? "slot.small" : "slot.large")) +
        "</label>" +
        customSelectHtml("slot-" + slot, cur, opts) +
        hintHtml(slot === "small" ? "slot_small" : "slot_large")
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
        if (!ref) return;
        var cut = ref.indexOf("/");
        applyOp("setModelSlot", [slot, { provider: ref.slice(0, cut), model: ref.slice(cut + 1) }]);
      };
    }
    bindSlot(largeEl, "large");
    bindSlot(smallEl, "small");
  }

  function renderModels(list, doc) {
    entries(doc.providers).forEach(function (p) {
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
    entries(map).forEach(function (item) {
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
      list.innerHTML = '<div class="empty">' + esc(t("empty.skills")) + "</div>";
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
    Object.keys(doc.hooks || {}).forEach(function (event) {
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
    (doc.permissions.allowed_tools || []).forEach(function (toolName) {
      list.insertAdjacentHTML("beforeend", cardHtml("allow:" + toolName, toolName, t("perm.allowSub"), '<span class="badge">' + esc(t("badge.allow")) + "</span>", state.selected === "allow:" + toolName));
    });
    ((doc.options && doc.options.disabled_tools) || []).forEach(function (toolName) {
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
    var first = form.querySelector("input:not([type=hidden]):not([type=checkbox]), textarea");
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
    var payload = providerPayload();
    if (!payload.id) {
      showStatus(t("model.needProvider"), "error");
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
        field("edit_name", t("field.modelName"), m.name || m.id) +
        field("edit_ctx", t("field.contextWindow"), m.context_window || "") +
        "</div>" +
        '<div class="row">' +
        field("edit_max", t("field.defaultMaxTokens"), m.default_max_tokens || "") +
        field("edit_price_in", t("field.priceIn"), m.cost_per_1m_in || "") +
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
      "<label>" +
      esc(t("form.manualModel")) +
      "</label>" +
      '<div class="manual-add-row">' +
      '<input id="f-model_id" name="model_id" type="text" placeholder="' +
      esc(t("field.modelId")) +
      '" />' +
      '<input id="f-model_name" name="model_name" type="text" placeholder="' +
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
          showStatus(t("model.needId"), "error");
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
      field("id", t("field.id"), id) +
        field("name", t("field.name"), p.name) +
        field("type", t("field.type"), p.type || "openai", "select", { options: PROVIDER_TYPES }) +
        field("base_url", t("field.baseUrl"), p.base_url) +
        field("api_key", t("field.apiKey"), p.api_key) +
        field("system_prompt_prefix", t("field.systemPromptPrefix"), p.system_prompt_prefix) +
        '<div class="row">' +
        field("disable", t("field.disabled"), p.disable, "checkbox") +
        field("flat_rate", t("field.flatRate"), p.flat_rate, "checkbox") +
        "</div>" +
        field("discover_models", t("field.discoverModels"), p.discover_models !== false, "checkbox") +
        field("extra_headers", t("field.extraHeaders"), kvText(p.extra_headers), "textarea") +
        field("extra_body", t("field.extraBody"), p.extra_body ? JSON.stringify(p.extra_body, null, 2) : "", "textarea") +
        "<h2>" + esc(t("form.customModels")) + "</h2>" +
        '<div id="modelEditor"></div>' +
        formButtons(true, true, p.disable),
      modalTitleText("form.providerNew", "form.provider"),
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      try {
        saveProvider()
          .then(function (pid) {
            if (!pid) return;
            state.selected = pid;
            hideForm();
          })
          .catch(function (err) {
            showStatus(err.message || String(err), "error");
          });
      } catch (err) {
        showStatus(err.message || t("err.extraBodyJson"), "error");
      }
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

  function openMcp(id) {
    var m = state.data.document.mcp[id] || {};
    showForm(
      " <h2>" + esc(t("form.mcp")) + "</h2>" +
        field("name", t("field.name"), id) +
        field("type", t("field.transport"), m.type || "stdio", "select", {
          options: ["stdio", "http", "sse"],
          hint: t("hint.transport"),
        }) +
        field("command", t("field.command"), m.command) +
        field("args", t("field.args"), (m.args || []).join("\n"), "textarea") +
        field("env", t("field.envKv"), kvText(m.env), "textarea") +
        field("url", t("field.url"), m.url) +
        field("headers", t("field.headers"), kvText(m.headers), "textarea") +
        field("timeout", t("field.timeout"), m.timeout || "") +
        field("disabled", t("field.disabled"), m.disabled, "checkbox") +
        field("disabled_tools", t("field.disabledTools"), (m.disabled_tools || []).join("\n"), "textarea") +
        field("enabled_tools", t("field.enabledTools"), (m.enabled_tools || []).join("\n"), "textarea") +
        field("oauth", t("field.oauth"), m.oauth, "checkbox") +
        field("oauth_client_id", t("field.oauthClientId"), m.oauth_client_id) +
        field("oauth_client_secret", t("field.oauthClientSecret"), m.oauth_client_secret) +
        field("oauth_callback_port", t("field.oauthCallbackPort"), m.oauth_callback_port || "") +
        formButtons(true, true, m.disabled),
      modalTitleText("form.mcpNew", "form.mcp"),
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      var name = val("name");
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
    var l = state.data.document.lsp[id] || {};
    showForm(
      field("name", t("field.name"), id) +
        field("command", t("field.command"), l.command) +
        field("args", t("field.args"), (l.args || []).join("\n"), "textarea") +
        field("env", t("field.envKv"), kvText(l.env), "textarea") +
        field("filetypes", t("field.filetypes"), (l.filetypes || []).join("\n"), "textarea") +
        field("root_markers", t("field.rootMarkers"), (l.root_markers || []).join("\n"), "textarea") +
        field("timeout", t("field.timeout"), l.timeout || "") +
        field("disabled", t("field.disabled"), l.disabled, "checkbox") +
        field("init_options", t("field.initOptions"), l.init_options ? JSON.stringify(l.init_options, null, 2) : "", "textarea") +
        field("options", t("field.optionsJson"), l.options ? JSON.stringify(l.options, null, 2) : "", "textarea") +
        formButtons(true, true, l.disabled),
      modalTitleText("form.lspNew", "form.lsp"),
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
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
      if (inito.trim()) server.init_options = JSON.parse(inito);
      if (opt.trim()) server.options = JSON.parse(opt);
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
      field("event", t("field.event"), event, "select", { options: ["PreToolUse"] }) +
        field("name", t("field.name"), h.name || "") +
        field("command", t("field.command"), h.command || "") +
        field("matcher", t("field.matcher"), h.matcher || "") +
        field("timeout", t("field.timeout"), h.timeout || 30) +
        formButtons(true, false),
      "form.hook",
    );
    $("form").onsubmit = function (e) {
      e.preventDefault();
      var ev = val("event");
      var nm = val("name");
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
      field("name", t("field.name"), skill.name) +
        field("description", t("field.description"), skill.description || "", "textarea") +
        field("source", t("field.source"), skill.source || "") +
        field("path", t("field.path"), skill.path || "") +
        field("disabled", t("field.disabled"), skill.disabled, "checkbox") +
        '<div class="form-actions"><button type="submit" class="primary">' +
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
      field("tool", t("field.tool"), tool) +
        field("kind", t("field.kind"), kind, "select", {
          options: [
            { value: "allow", label: t("badge.allow") },
            { value: "deny", label: t("badge.deny") },
          ],
        }) +
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
        field("data_directory", "data-directory", o.data_directory || "") +
        field("initialize_as", "initialize-as", o.initialize_as || "AGENTS.md", "select", {
          options: (function () {
            var opts = ["AGENTS.md", "CRUSH.md", "CLAUDE.md", "GEMINI.md", "docs/LLMs.md"];
            if (o.initialize_as && opts.indexOf(o.initialize_as) < 0) opts.unshift(o.initialize_as);
            return opts;
          })(),
        }) +
        field("notifications", "notifications", o.notifications || "auto", "select", {
          options: ["auto", "native", "osc", "bell", "disabled"],
        }) +
        field("generated_with", "attribution-generated-with", attr.generated_with !== false, "checkbox") +
        field("trailer", "attribution-trailer-style", attr.trailer_style || "assisted-by", "select", {
          options: ["none", "co-authored-by", "assisted-by"],
        }) +
        field("context_paths", t("field.contextPaths"), (o.context_paths || []).join("\n"), "textarea") +
        field("global_context_paths", t("field.globalContextPaths"), (o.global_context_paths || []).join("\n"), "textarea") +
        field("skills_paths", t("field.skillPaths"), (o.skills_paths || []).join("\n"), "textarea") +
        field("disabled_skills", t("field.disableSkill"), (o.disabled_skills || []).join("\n"), "textarea") +
        "<h2>" + esc(t("form.optionUi")) + "</h2>" +
        '<div class="row">' +
        field("compact", "compact", tui.compact_mode, "checkbox") +
        field("transparent", "transparent", tui.transparent, "checkbox") +
        "</div>" +
        field("diff", "diff", tui.diff_mode || "unified", "select", { options: ["unified", "split"] }) +
        field("scrollbar", "scrollbar", tui.scrollbar || "default", "select", { options: ["default", "always", "never"] }) +
        '<div class="row">' +
        field("max_depth", "completions-max-depth", (tui.completions && tui.completions.max_depth) || "") +
        field("max_items", "completions-max-items", (tui.completions && tui.completions.max_items) || "") +
        "</div>" +
        '<div class="form-actions"><button type="submit" class="primary">' + esc(t("btn.apply")) + "</button></div>",
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
      field("key", t("field.key"), key) +
        field("value", t("field.value"), value) +
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
      '<div class="row">' +
        field("ls_depth", "ls max_depth", t.ls && t.ls.max_depth) +
        field("ls_items", "ls max_items", t.ls && t.ls.max_items) +
        "</div>" +
        '<div class="row">' +
        field("grep_timeout", "grep timeout", t.grep && t.grep.timeout) +
        field("glob_timeout", "glob timeout", t.glob && t.glob.timeout) +
        "</div>" +
        '<div class="form-actions"><button type="submit" class="primary">' + esc(t("btn.apply")) + "</button></div>",
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
        field("path", t("field.directory"), "") +
          '<div class="form-actions"><button type="submit" class="primary">' + esc(t("btn.addPath")) + "</button></div>",
        "form.skillPath",
      );
      $("form").onsubmit = function (e) {
        e.preventDefault();
        Promise.resolve(applyOp("addSkillPath", [val("path")], true)).then(function () {
          hideForm();
        });
      };
    } else if (state.section === "permissions") {
      showForm(
        field("tool", t("field.tool"), "") +
          field("kind", t("field.kind"), "allow", "select", {
            options: [
              { value: "allow", label: t("badge.allow") },
              { value: "deny", label: t("badge.deny") },
            ],
          }) +
          '<div class="form-actions"><button type="submit" class="primary">' + esc(t("btn.add")) + "</button></div>",
        "form.permissionNew",
      );
      $("form").onsubmit = function (e) {
        e.preventDefault();
        var op = val("kind") === "allow" ? "allowTool" : "denyTool";
        Promise.resolve(applyOp(op, [val("tool")], true)).then(function () {
          hideForm();
        });
      };
    } else if (state.section === "env") {
      showForm(
        field("key", t("field.key"), "") +
          field("value", t("field.value"), "") +
          '<div class="form-actions"><button type="submit" class="primary">' + esc(t("btn.add")) + "</button></div>",
        "form.envNew",
      );
      $("form").onsubmit = function (e) {
        e.preventDefault();
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
      if (e.key === "Escape" && state.modalOpen) hideForm();
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
