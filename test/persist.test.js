"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const persistApi = require("../src/index");

const FIXTURE_JSON = path.join(__dirname, "fixtures", "crush.json");
const FIXTURE_RC = path.join(__dirname, "fixtures", "crushrc");

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crush-setup-test-"));
  const home = path.join(root, "home");
  const xdg = path.join(root, "xdg-config");
  const ladd = path.join(root, "localappdata");
  const project = path.join(root, "project");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(xdg, { recursive: true });
  fs.mkdirSync(ladd, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  const env = {
    USERPROFILE: home,
    HOME: home,
    XDG_CONFIG_HOME: xdg,
    LOCALAPPDATA: ladd,
  };
  return { root, home, xdg, ladd, project, env };
}

function loadIn(box, extra = {}) {
  return persistApi.load({
    projectDir: extra.projectDir !== undefined ? extra.projectDir : box.project,
    env: box.env,
    writeScope: extra.writeScope || "project",
  });
}

describe("crush-setup persist", () => {
  let box;

  beforeEach(() => {
    box = makeSandbox();
  });

  afterEach(() => {
    fs.rmSync(box.root, { recursive: true, force: true });
  });

  it("loads a fixture crush.json with every config family", () => {
    fs.copyFileSync(FIXTURE_JSON, path.join(box.project, "crush.json"));
    const session = loadIn(box);
    const doc = session.document;
    assert.ok(doc.providers["fixture-openai"], "provider present");
    assert.equal(doc.providers["fixture-openai"].type, "openai");
    const model = (doc.providers["fixture-openai"].models || []).find((m) => m.id === "gpt-4o");
    assert.ok(model, "custom model present");
    assert.equal(model.context_window, 128000);
    assert.equal(doc.models.large.provider, "fixture-openai");
    assert.equal(doc.models.large.model, "gpt-4o");
    assert.equal(doc.mcp["fixture-stdio"].type, "stdio");
    assert.equal(doc.mcp["fixture-stdio"].command, "npx");
    assert.ok(doc.options.skills_paths.includes("./extra-skills"));
    assert.equal(doc.lsp.go.command, "gopls");
    assert.deepEqual(doc.lsp.go.filetypes, ["go", "mod"]);
    assert.equal(doc.hooks.PreToolUse[0].name, "no-haskell");
    assert.ok(doc.permissions.allowed_tools.includes("view"));
    assert.equal(doc.options.progress, true);
    assert.ok(doc.options.disabled_tools.includes("bash"));
    assert.equal(doc.env.FIXTURE_ENV, "json");
    assert.equal(doc.tools.ls.max_depth, 4);
    assert.ok(session.loadedPaths.some((p) => p.endsWith("crush.json")));
  });

  it("loads a fixture crushrc with every config family", () => {
    fs.copyFileSync(FIXTURE_RC, path.join(box.project, "crushrc"));
    const session = loadIn(box);
    const doc = session.document;
    assert.ok(doc.providers["fixture-compat"], "provider from crushrc");
    assert.equal(doc.providers["fixture-compat"].type, "openai-compat");
    const model = (doc.providers["fixture-compat"].models || []).find((m) => m.id === "local-model");
    assert.ok(model, "model from crushrc");
    assert.equal(model.context_window, 32000);
    assert.equal(doc.models.large.provider, "fixture-compat");
    assert.equal(doc.mcp["fixture-http"].type, "http");
    assert.equal(doc.mcp["fixture-http"].url, "https://api.githubcopilot.com/mcp/");
    assert.equal(doc.mcp["fixture-http"].oauth, true);
    assert.ok(doc.options.skills_paths.includes("./rc-skills"));
    assert.equal(doc.lsp.rust.command, "rust-analyzer");
    assert.equal(doc.hooks.PreToolUse[0].name, "log-bash");
    assert.ok(doc.permissions.allowed_tools.includes("grep"));
    assert.ok(doc.options.disabled_tools.includes("edit"));
    assert.equal(doc.options.progress, true);
    assert.equal(doc.options.tui.compact_mode, true);
  });

  it("add/update/disable/remove provider, custom model, mcp stdio+http, lsp, hook then reload", () => {
    let session = loadIn(box);
    session = persistApi.apply(session, "upsertProvider", [
      { id: "alpha", name: "Alpha", type: "openai-compat", base_url: "http://alpha", api_key: "k1" },
    ]);
    session = persistApi.apply(session, "upsertModel", [
      "alpha",
      { id: "m1", name: "Model One", context_window: 8000, default_max_tokens: 512 },
    ]);
    session = persistApi.apply(session, "upsertMcp", [
      "stdio-one",
      { type: "stdio", command: "uvx", args: ["mcp-server"] },
    ]);
    session = persistApi.apply(session, "upsertMcp", [
      "http-one",
      { type: "http", url: "https://example.com/mcp", headers: { Auth: "x" } },
    ]);
    session = persistApi.apply(session, "upsertLsp", [
      "py",
      { command: "pyright-langserver", args: ["--stdio"], filetypes: ["py"] },
    ]);
    session = persistApi.apply(session, "addHook", [
      "PreToolUse",
      { name: "block", command: "./block.sh", matcher: "^bash$", timeout: 5 },
    ]);
    persistApi.save(session);

    session = persistApi.reload(session);
    assert.equal(session.document.providers.alpha.type, "openai-compat");
    assert.equal(session.document.providers.alpha.models[0].id, "m1");
    assert.equal(session.document.mcp["stdio-one"].type, "stdio");
    assert.equal(session.document.mcp["http-one"].type, "http");
    assert.equal(session.document.lsp.py.command, "pyright-langserver");
    assert.equal(session.document.hooks.PreToolUse[0].name, "block");

    session = persistApi.apply(session, "upsertProvider", [
      { id: "alpha", name: "Alpha Updated", type: "openai-compat", base_url: "http://alpha2" },
    ]);
    session = persistApi.apply(session, "upsertModel", [
      "alpha",
      { id: "m1", name: "Model One Updated", context_window: 16000 },
    ]);
    session = persistApi.apply(session, "upsertMcp", [
      "stdio-one",
      { type: "stdio", command: "npx", args: ["-y", "server"] },
    ]);
    session = persistApi.apply(session, "upsertMcp", [
      "http-one",
      { type: "http", url: "https://example.com/mcp-v2" },
    ]);
    session = persistApi.apply(session, "upsertLsp", ["py", { command: "pylsp" }]);
    session = persistApi.apply(session, "removeHook", ["PreToolUse", "block"]);
    session = persistApi.apply(session, "addHook", [
      "PreToolUse",
      { name: "block", command: "./block2.sh", matcher: "^edit$" },
    ]);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.providers.alpha.name, "Alpha Updated");
    assert.equal(session.document.providers.alpha.base_url, "http://alpha2");
    assert.equal(session.document.providers.alpha.models[0].name, "Model One Updated");
    assert.equal(session.document.providers.alpha.models[0].context_window, 16000);
    assert.equal(session.document.mcp["stdio-one"].command, "npx");
    assert.equal(session.document.mcp["http-one"].url, "https://example.com/mcp-v2");
    assert.equal(session.document.lsp.py.command, "pylsp");
    assert.equal(session.document.hooks.PreToolUse[0].command, "./block2.sh");

    session = persistApi.apply(session, "setProviderDisabled", ["alpha", true]);
    session = persistApi.apply(session, "setMcpDisabled", ["stdio-one", true]);
    session = persistApi.apply(session, "setMcpDisabled", ["http-one", true]);
    session = persistApi.apply(session, "setLspDisabled", ["py", true]);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.providers.alpha.disable, true);
    assert.equal(session.document.mcp["stdio-one"].disabled, true);
    assert.equal(session.document.mcp["http-one"].disabled, true);
    assert.equal(session.document.lsp.py.disabled, true);
    assert.ok(session.document.providers.alpha, "disabled provider still present");
    assert.ok(session.document.mcp["stdio-one"], "disabled mcp still present");

    session = persistApi.apply(session, "removeProvider", ["alpha"]);
    session = persistApi.apply(session, "removeMcp", ["stdio-one"]);
    session = persistApi.apply(session, "removeMcp", ["http-one"]);
    session = persistApi.apply(session, "removeLsp", ["py"]);
    session = persistApi.apply(session, "removeHook", ["PreToolUse", "block"]);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.providers.alpha, undefined);
    assert.equal(session.document.mcp["stdio-one"], undefined);
    assert.equal(session.document.mcp["http-one"], undefined);
    assert.equal(session.document.lsp.py, undefined);
    assert.equal((session.document.hooks.PreToolUse || []).length, 0);
  });

  it("sets large and small slots and reloads them", () => {
    let session = loadIn(box);
    session = persistApi.apply(session, "upsertProvider", [
      { id: "slotp", type: "openai", name: "Slot" },
    ]);
    session = persistApi.apply(session, "upsertModel", ["slotp", { id: "big", name: "Big" }]);
    session = persistApi.apply(session, "upsertModel", ["slotp", { id: "tiny", name: "Tiny" }]);
    session = persistApi.apply(session, "setModelSlot", [
      "large",
      {
        provider: "slotp",
        model: "big",
        think: true,
        reasoning_effort: "high",
        max_tokens: 2048,
        temperature: 0.4,
        top_p: 0.9,
        top_k: 40,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
      },
    ]);
    session = persistApi.apply(session, "setModelSlot", [
      "small",
      { provider: "slotp", model: "tiny", max_tokens: 256 },
    ]);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.models.large.provider, "slotp");
    assert.equal(session.document.models.large.model, "big");
    assert.equal(session.document.models.large.think, true);
    assert.equal(session.document.models.large.reasoning_effort, "high");
    assert.equal(session.document.models.large.max_tokens, 2048);
    assert.equal(session.document.models.large.temperature, 0.4);
    assert.equal(session.document.models.small.provider, "slotp");
    assert.equal(session.document.models.small.model, "tiny");
    assert.equal(session.document.models.small.max_tokens, 256);
  });

  it("discovers two SKILL.md dirs and toggles disable-skill", () => {
    const skillA = path.join(box.project, ".agents", "skills", "alpha-skill");
    const skillB = path.join(box.project, "custom-skills", "beta-skill");
    fs.mkdirSync(skillA, { recursive: true });
    fs.mkdirSync(skillB, { recursive: true });
    fs.writeFileSync(
      path.join(skillA, "SKILL.md"),
      "---\nname: alpha-skill\ndescription: First discovered skill\n---\n# Alpha\n",
    );
    fs.writeFileSync(
      path.join(skillB, "SKILL.md"),
      "---\nname: beta-skill\ndescription: Second discovered skill\n---\n# Beta\n",
    );

    let session = loadIn(box);
    session = persistApi.apply(session, "addSkillPath", [path.join(box.project, "custom-skills")]);
    persistApi.save(session);
    session = persistApi.reload(session);

    let skills = persistApi.listSkills(session);
    const names = skills.map((s) => s.name).sort();
    assert.deepEqual(names, ["alpha-skill", "beta-skill"]);
    assert.equal(skills.find((s) => s.name === "alpha-skill").disabled, false);

    session = persistApi.apply(session, "setSkillDisabled", ["alpha-skill", true]);
    persistApi.save(session);
    session = persistApi.reload(session);
    skills = persistApi.listSkills(session);
    const alpha = skills.find((s) => s.name === "alpha-skill");
    const beta = skills.find((s) => s.name === "beta-skill");
    assert.ok(alpha, "disabled skill remains listed");
    assert.equal(alpha.disabled, true);
    assert.equal(beta.disabled, false);
    assert.ok(session.document.options.disabled_skills.includes("alpha-skill"));
  });

  it("writes twice atomically without truncating", () => {
    let session = loadIn(box);
    session = persistApi.apply(session, "upsertProvider", [
      { id: "w", type: "ollama", name: "Write One", base_url: "http://localhost:11434/v1" },
    ]);
    persistApi.save(session);
    const first = fs.readFileSync(session.writeTarget.path, "utf8");
    JSON.parse(first);
    session = persistApi.apply(session, "upsertProvider", [
      { id: "w", type: "ollama", name: "Write Two", base_url: "http://localhost:11434/v1" },
    ]);
    persistApi.save(session);
    const second = fs.readFileSync(session.writeTarget.path, "utf8");
    const parsed = JSON.parse(second);
    assert.equal(parsed.providers.w.name, "Write Two");
    assert.ok(second.trim().endsWith("}"));
    assert.notEqual(first, second);
  });

  it("reload keeps unrelated keys the loader understood", () => {
    fs.copyFileSync(FIXTURE_JSON, path.join(box.project, "crush.json"));
    let session = loadIn(box);
    session = persistApi.apply(session, "setOption", ["progress", false]);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.options.progress, false);
    assert.equal(session.document.providers["fixture-openai"].type, "openai");
    assert.equal(session.document.mcp["fixture-stdio"].command, "npx");
    assert.equal(session.document.lsp.go.command, "gopls");
    assert.equal(session.document.env.FIXTURE_ENV, "json");
    assert.equal(session.document.tools.ls.max_items, 200);
  });

  it("reads machine JSON but writes user/project config", () => {
    const machineDir = path.join(box.ladd, "crush");
    fs.mkdirSync(machineDir, { recursive: true });
    fs.writeFileSync(
      path.join(machineDir, "crush.json"),
      JSON.stringify({ env: { FROM_MACHINE: "yes" } }),
    );
    let session = loadIn(box);
    assert.equal(session.document.env.FROM_MACHINE, "yes");
    session = persistApi.apply(session, "setEnv", ["FROM_USER", "1"]);
    persistApi.save(session);
    assert.ok(session.writeTarget.path.includes(box.project) || session.writeTarget.path.includes("xdg-config"));
    assert.ok(!session.writeTarget.path.startsWith(machineDir));
    session = persistApi.reload(session);
    assert.equal(session.document.env.FROM_USER, "1");
    assert.equal(session.document.env.FROM_MACHINE, "yes");
  });

  it("does not overwrite a sibling user crushrc when writing complementary JSON", () => {
    const userRc = path.join(box.project, "crushrc");
    fs.writeFileSync(userRc, "if [[ $HOSTNAME == x ]]; then\n  option debug true\nfi\n");
    let session = loadIn(box);
    session = persistApi.apply(session, "upsertProvider", [
      { id: "safe", type: "openai", name: "Safe" },
    ]);
    persistApi.save(session);
    const rcAfter = fs.readFileSync(userRc, "utf8");
    assert.match(rcAfter, /HOSTNAME/);
    assert.equal(session.writeTarget.format, "json");
    session = persistApi.reload(session);
    assert.ok(session.document.providers.safe);
  });

  it("crushrc-only save keeps env and tools via complementary crush.json", () => {
    fs.writeFileSync(
      path.join(box.project, "crushrc"),
      "# Generated by crush-setup. Builtin commands only.\noption debug true\n",
    );
    let session = loadIn(box);
    assert.equal(session.writeTarget.format, "crushrc");
    session = persistApi.apply(session, "setEnv", ["FOO", "bar"]);
    session = persistApi.apply(session, "setTools", [{ grep: { timeout: 9 }, glob: { timeout: 3 } }]);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.env.FOO, "bar");
    assert.equal(session.document.tools.grep.timeout, 9);
    assert.equal(session.document.tools.glob.timeout, 3);
    const complement = JSON.parse(fs.readFileSync(path.join(box.project, "crush.json"), "utf8"));
    assert.equal(complement.env.FOO, "bar");
    assert.equal(complement.tools.grep.timeout, 9);
    session = persistApi.reload(session);
    assert.equal(session.writeTarget.format, "crushrc");
    session = persistApi.apply(session, "removeEnv", ["FOO"]);
    session = persistApi.apply(session, "removeTools", ["grep"]);
    assert.equal(session.document.env.FOO, undefined);
    assert.equal(session.document.tools && session.document.tools.grep, undefined);
    assert.equal(session.document.tools.glob.timeout, 3);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.env.FOO, undefined);
    assert.equal(session.document.tools && session.document.tools.grep, undefined);
    assert.equal(session.document.tools.glob.timeout, 3);
  });

  it("global crushrc keeps write target after complementary json; provider rename and removeEnv persist", () => {
    const globalDir = path.join(box.xdg, "crush");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalDir, "crushrc"),
      "# Generated by crush-setup. Builtin commands only.\n" +
        'provider add acme --name Acme --type openai\n' +
        "option progress true\n",
    );
    let session = loadIn(box, { writeScope: "global" });
    assert.equal(session.writeTarget.format, "crushrc");
    assert.equal(session.document.providers.acme.name, "Acme");
    assert.equal(session.document.options.progress, true);

    session = persistApi.apply(session, "setEnv", ["FOO", "bar"]);
    assert.equal(session.document.env.FOO, "bar");
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.writeTarget.format, "crushrc");
    assert.equal(session.document.env.FOO, "bar");
    assert.equal(session.document.providers.acme.name, "Acme");

    session = persistApi.apply(session, "upsertProvider", [
      { id: "acme", name: "Acme Renamed", type: "openai" },
    ]);
    session = persistApi.apply(session, "setOption", ["progress", false]);
    assert.equal(session.document.providers.acme.name, "Acme Renamed");
    assert.equal(session.document.options.progress, false);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.writeTarget.format, "crushrc");
    assert.equal(session.document.providers.acme.name, "Acme Renamed");
    assert.equal(session.document.options.progress, false);
    assert.equal(session.document.env.FOO, "bar");

    session = persistApi.apply(session, "removeEnv", ["FOO"]);
    assert.equal(session.document.env.FOO, undefined);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.env.FOO, undefined);
    assert.equal(session.document.providers.acme.name, "Acme Renamed");
  });

  it("project save does not copy or duplicate global hooks", () => {
    let global = loadIn(box, { writeScope: "global" });
    global = persistApi.apply(global, "addHook", [
      "PreToolUse",
      { name: "from-global", command: "echo g", timeout: 5 },
    ]);
    persistApi.save(global);

    let project = loadIn(box, { writeScope: "project" });
    project = persistApi.apply(project, "setOption", ["progress", false]);
    persistApi.save(project);
    project = persistApi.reload(project);
    assert.equal(project.document.hooks.PreToolUse.length, 1);
    assert.equal(project.document.hooks.PreToolUse[0].name, "from-global");
    const afterOption = JSON.parse(fs.readFileSync(project.writeTarget.path, "utf8"));
    assert.equal((afterOption.hooks && afterOption.hooks.PreToolUse) || undefined, undefined);

    project = persistApi.apply(project, "addHook", [
      "PreToolUse",
      { name: "from-project", command: "echo p", timeout: 6 },
    ]);
    persistApi.save(project);
    project = persistApi.reload(project);
    const names = project.document.hooks.PreToolUse.map((h) => h.name).sort();
    assert.deepEqual(names, ["from-global", "from-project"]);
    assert.equal(project.document.hooks.PreToolUse.length, 2);
    const written = JSON.parse(fs.readFileSync(project.writeTarget.path, "utf8"));
    const writtenNames = ((written.hooks && written.hooks.PreToolUse) || []).map((h) => h.name);
    assert.deepEqual(writtenNames, ["from-project"]);
  });

  it("sse mcp persists through save/reload", () => {
    let session = loadIn(box);
    session = persistApi.apply(session, "upsertMcp", [
      "sse-one",
      { type: "sse", url: "https://example.com/sse", timeout: 12 },
    ]);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.mcp["sse-one"].type, "sse");
    assert.equal(session.document.mcp["sse-one"].url, "https://example.com/sse");
  });

  it("discoverModels fetches /models from a live fixture server", async () => {
    const http = require("node:http");
    const { discoverModels } = persistApi;
    const server = http.createServer((req, res) => {
      const auth = req.headers.authorization || "";
      if (req.url === "/v1/models" && auth === "Bearer secret-from-env") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "alpha-7b", name: "Alpha 7B" }, { id: "beta" }] }));
        return;
      }
      if (req.url === "/api/tags") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ models: [{ name: "llama3.2:latest" }] }));
        return;
      }
      res.writeHead(404);
      res.end("no");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
      const listed = await discoverModels({
        type: "openai-compat",
        baseUrl: `http://127.0.0.1:${port}/v1`,
        apiKey: "$PROBE_KEY",
        env: { PROBE_KEY: "secret-from-env" },
        existingIds: ["beta"],
      });
      assert.equal(listed.ok, true);
      assert.deepEqual(
        listed.models.map((m) => m.id).sort(),
        ["alpha-7b", "beta"],
      );
      assert.equal(listed.models.find((m) => m.id === "beta").registered, true);
      assert.equal(listed.models.find((m) => m.id === "alpha-7b").name, "Alpha 7B");

      const ollama = await discoverModels({
        type: "ollama",
        baseUrl: `http://127.0.0.1:${port}/v1`,
        timeoutMs: 2000,
      });
      assert.equal(ollama.ok, true);
      assert.equal(ollama.models[0].id, "llama3.2:latest");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("i18n auto-detects Chinese vs English and catalogs stay aligned", () => {
    const vm = require("node:vm");
    const src = fs.readFileSync(path.join(__dirname, "..", "ui", "i18n.js"), "utf8");
    const sandbox = { window: { navigator: { language: "en-US", languages: ["en-US"] } } };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const i18n = sandbox.window.crushI18n;
    assert.equal(i18n.detectFromNavigator({ language: "zh-CN", languages: ["zh-CN", "en"] }), "zh");
    assert.equal(i18n.detectFromNavigator({ language: "zh-TW", languages: ["zh-TW"] }), "zh");
    assert.equal(i18n.detectFromNavigator({ language: "en-US", languages: ["en-US"] }), "en");
    i18n.setLang("zh", { language: "en-US" });
    assert.equal(i18n.t("nav.models"), "模型");
    assert.equal(i18n.t("btn.save"), "保存");
    i18n.setLang("en", { language: "zh-CN" });
    assert.equal(i18n.t("nav.models"), "Models");
    assert.equal(i18n.t("btn.save"), "Save");
    const enKeys = Object.keys(i18n.catalogs.en).sort();
    const zhKeys = Object.keys(i18n.catalogs.zh).sort();
    assert.deepEqual(zhKeys, enKeys);
    assert.doesNotMatch(src, /\brequire\s*\(/);
    assert.doesNotMatch(src, /\bmodule\.exports\b/);
  });

  it("ui/app.js executes with window defined and no Node module", () => {
    const vm = require("node:vm");
    const i18nJs = fs.readFileSync(path.join(__dirname, "..", "ui", "i18n.js"), "utf8");
    const js = fs.readFileSync(path.join(__dirname, "..", "ui", "app.js"), "utf8");
    function el() {
      return {
        hidden: false,
        textContent: "",
        className: "",
        value: "",
        innerHTML: "",
        checked: false,
        type: "text",
        style: {},
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener() {},
        querySelectorAll() {
          return [];
        },
        querySelector() {
          return null;
        },
        setAttribute() {},
        getAttribute() {
          return "";
        },
        insertAdjacentHTML() {},
        closest() {
          return this;
        },
      };
    }
    const fake = el();
    const sandbox = {
      window: { location: { protocol: "file:" } },
      document: {
        getElementById() {
          return el();
        },
        querySelectorAll() {
          return [fake];
        },
        querySelector() {
          return fake;
        },
      },
      console,
      fetch() {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      },
    };
    sandbox.window.document = sandbox.document;
    sandbox.window.crushSetup = null;
    sandbox.window.navigator = { language: "zh-CN", languages: ["zh-CN"] };
    sandbox.window.localStorage = {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    };
    vm.createContext(sandbox);
    vm.runInContext(i18nJs, sandbox);
    vm.runInContext(js, sandbox);
    assert.equal(typeof sandbox.window, "object");
    assert.equal(sandbox.window.crushI18n.lang, "zh");
  });

  it("desktop UI contract: navigator, CRUD, Charmtone tokens, browser-safe scripts", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "ui", "index.html"), "utf8");
    const css = fs.readFileSync(path.join(__dirname, "..", "ui", "styles.css"), "utf8");
    const js = fs.readFileSync(path.join(__dirname, "..", "ui", "app.js"), "utf8");
    const i18nJs = fs.readFileSync(path.join(__dirname, "..", "ui", "i18n.js"), "utf8");
    const entry = fs.readFileSync(path.join(__dirname, "..", "bin", "crush-setup.js"), "utf8");
    const main = fs.readFileSync(path.join(__dirname, "..", "electron", "main.js"), "utf8");

    assert.match(html, /data-section="models"/);
    assert.match(html, /data-section="skills"/);
    assert.match(html, /data-section="mcp"/);
    assert.match(html, /data-section="lsp"/);
    assert.match(html, /data-section="hooks"/);
    assert.match(html, /data-section="permissions"/);
    assert.match(html, /data-section="options"/);
    assert.match(html, /id="addBtn"/);
    assert.match(html, /id="saveBtn"/);
    assert.match(html, /i18n\.js/);
    assert.match(html, /data-i18n="nav.models"/);
    assert.match(html, /data-lang="zh"/);
    assert.match(html, /class="titlebar"/);
    assert.match(html, /icon\.png/);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "icon.ico")));
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "icon.png")));
    assert.match(fs.readFileSync(path.join(__dirname, "..", "electron", "main.js"), "utf8"), /requestSingleInstanceLock/);
    assert.match(js, /cselect/);
    assert.match(js, /fetchModelsBtn/);
    assert.match(js, /addModelBtn/);
    assert.match(js, /discoverModels/);
    assert.match(css, /::-webkit-scrollbar/);
    assert.match(js, /setProviderDisabled|setMcpDisabled|setLspDisabled|setSkillDisabled/);
    assert.match(js, /removeProvider|removeMcp|removeLsp/);
    assert.match(css, /--pepper/);
    assert.match(css, /--charple/);
    assert.match(css, /--dolly/);
    assert.match(css, /--butter/);
    assert.match(css, /#1c1917/);
    assert.doesNotMatch(js, /\brequire\s*\(/);
    assert.doesNotMatch(js, /\bmodule\.exports\b/);
    assert.match(js, /file:/);
    assert.match(i18nJs, /crush-setup/);
    assert.match(i18nJs, /配置管理/);
    assert.match(entry, /--self-check/);
    assert.match(main, /Crush Setup/);
    assert.match(main, /loadFile/);
  });

  it("option + option ui + env + tools persist", () => {
    let session = loadIn(box);
    session = persistApi.apply(session, "setOption", ["debug", true]);
    session = persistApi.apply(session, "setOption", ["metrics", false]);
    session = persistApi.apply(session, "setOption", ["notifications", "bell"]);
    session = persistApi.apply(session, "setOption", ["attribution-trailer-style", "assisted-by"]);
    session = persistApi.apply(session, "setOptionUi", ["diff", "split"]);
    session = persistApi.apply(session, "setOptionUi", ["completions-max-items", 80]);
    session = persistApi.apply(session, "setEnv", ["FOO", "bar"]);
    session = persistApi.apply(session, "setTools", [{ grep: { timeout: 9 }, glob: { timeout: 3 } }]);
    persistApi.save(session);
    session = persistApi.reload(session);
    assert.equal(session.document.options.debug, true);
    assert.equal(session.document.options.disable_metrics, true);
    assert.equal(session.document.options.notifications, "bell");
    assert.equal(session.document.options.attribution.trailer_style, "assisted-by");
    assert.equal(session.document.options.tui.diff_mode, "split");
    assert.equal(session.document.options.tui.completions.max_items, 80);
    assert.equal(session.document.env.FOO, "bar");
    assert.equal(session.document.tools.grep.timeout, 9);
  });
});
