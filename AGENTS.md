# AGENTS.md

Crush Setup is a desktop config manager for [Crush](https://github.com/charmbracelet/crush) (Charmbracelet's CLI coding agent). It edits the `crush.json` / `crushrc` files Crush actually loads: providers & models, skills, MCP, LSP, hooks, permissions, options, env, and tools. It also installs/upgrades Crush itself.

## Commands

```bash
npm install          # only devDeps: electron, electron-builder (zero runtime deps)
npm start            # Electron app (electron .)
npm run desktop      # headless fallback: node bin/crush-setup.js
npm test             # node --test test/persist.test.js test/install.test.js
npm run probe        # two-process persist write/read probe
npm run self-check   # prints JSON health check, exit 1 on failure
npm run dist         # electron-builder --publish never (also dist:win / dist:mac / dist:linux)
npm run version:next # computes next version AND rewrites package.json (side effect — don't commit blindly)
```

There is no lint/format step and no bundler. Node >= 18 required; CI runs Node 22. Tests use the built-in `node:test` runner + `node:assert/strict` — no framework. `npm test` hardcodes the two test files in package.json; add new test files there.

## Architecture

Three interchangeable hosts share one core. The UI picks whichever is present:

```
ui/app.js  ── window.crushSetup bridge (Electron preload, contextIsolation)
           └─ fetch /api/*            (src/server.js, plain node:http)
                        │
             src/session-host.js  createHost() — single in-memory session
                        │
        ┌───────────────┼──────────────────────────────────┐
  src/persist.js   src/mutators.js   src/install.js   src/discover.js
  load/save/apply  pure doc ops      winget/scoop/    GET /models
  layered config   (OPS map)         brew/npm         discovery
```

- `bin/crush-setup.js` — entry: spawns Electron if installed, else serves the UI on 127.0.0.1 and opens Edge `--app` mode (Windows) or default browser. Also `--self-check`, `--serve [port]`, `--persist-probe <dir>`.
- `electron/main.js` — frameless single-instance window; registers `crush:*` and `win:*` IPC handlers that all delegate to `createHost()`. Handles `--self-check` before creating a window.
- `src/server.js` — mirrors the same host methods as `/api/*` endpoints and serves `ui/` statically. Keep API parity between IPC handlers and HTTP routes when adding host methods.
- `src/session-host.js` — holds one `session`. `apply()` mutates **and immediately saves** (this is the app's "auto-save" behavior); `state()` returns document + loadedPaths + writeTarget + skills.
- `src/index.js` — flat re-export barrel of all src modules; tests require `../src/index`.

### Config layering (src/persist.js + src/document.js + src/paths.js)

`load()` mirrors Crush's own lookup order (see `paths.js`, modeled on Crush `internal/config/load.go`):

global `crush.json` < global `crushrc` < machine JSON (**read-only**, `%LOCALAPPDATA%\crush\crush.json`) < project `crush.json` < `.crush.json` < `crushrc` < `.crushrc` (later wins). Env overrides: `CRUSH_GLOBAL_CONFIG`, `CRUSH_GLOBAL_DATA`, `CRUSH_SKILLS_DIR`.

Critical invariants:

- **Only the overlay is persisted.** `session.document` is the merged view across all layers; mutations (`apply`) touch `session.overlay`, which corresponds to the single write-target file. `save()` serializes only the overlay so lower-priority layers are never re-emitted into higher-priority files. Never write the merged document.
- **Write target selection** (`chooseWriteTarget`): a crushrc that is managed or fully parseable stays the write target even when a sibling crush.json exists (crushrc wins same-dir merge). If nothing exists in scope, project defaults to creating `crush.json`, global to `~/.config/crush/crush.json`. Project scope silently falls back to global when no project dir is set. Machine JSON is never writable.
- **Complementary JSON**: crushrc cannot express `env`/`tools`. When the write target is crushrc, those two families are written to a sibling file (`crushrc` ↔ `crush.json`, `.crushrc` ↔ `.crush.json`), which is deleted when both families become empty. The sibling is excluded from merge inputs after seeding onto the overlay — otherwise `removeEnv` etc. would not be visible in `session.document` without a reload.
- Merge semantics (`mergeDocuments`): named maps (providers/mcp/lsp) merge per key; provider `models` arrays merge by `id`; hooks and `allowed_tools` accumulate across layers; option lists (`context_paths`, `skills_paths`, `disabled_skills`, `disabled_tools`, …) union with dedupe; scalars: later wins.

### crushrc language (src/crushrc.js)

- Parser understands only Crush builtin commands: `provider`, `model` (add/remove/large/small), `mcp`, `lsp`, `hook`, `permissions` (allow/deny), `option` (incl. `option ui`, `option reset`). Backslash line continuations; `#` comments; quotes.
- Anything else (control flow, `source`, `export`, unknown commands) lands in `unparsed` — an `unparsed` non-empty makes the file "unsafe": it will not be chosen as write target, protecting hand-written shell rc files.
- `generateCrushrc()` always rewrites the whole file starting with `MANAGED_CRUSHRC_MARK` ("# Generated by crush-setup. Builtin commands only."); `isManagedCrushrc` detects it via substring "Generated by crush-setup". Comments in a non-managed but parseable crushrc are dropped on save — by design.
- `serializeJson()` always emits `$schema` first (`https://charm.land/crush.json`) and omits empty families.

### Options mapping (src/constants.js)

`OPTION_SPECS` maps user-facing kebab keys to JSON snake keys. Several are **inverted booleans** (`metrics` → `disable_metrics`, `auto-summarize` → `disable_auto_summarize`, etc.): `setOption` negates the value when `inverted: true`. Both the JSON mutator (`setOption`) and crushrc parser/generator must agree — update all three places when adding an option. `attribution-*` options are special-cased in both mutators.js and crushrc.js. Only hook event today: `PreToolUse`.

### Mutators (src/mutators.js)

Every op is a pure function `(doc, ...args) → newDoc` (clone first, mutate copy), dispatched by name through `OPS`/`applyOp`. The op name is the API contract between UI, HTTP `/api/apply`, and IPC — adding an op means adding it to `OPS`.

### Skills & discovery

- `src/skills.js` walks fixed default dirs (project `.agents|.crush|.claude|.cursor/skills`; global `xdg/crush/skills`, `xdg/agents/skills`, `~/.agents/skills`, `~/.claude/skills`, plus Windows LOCALAPPDATA variants) plus configured `skills_paths`, parses `SKILL.md` front matter with a hand-rolled parser (no YAML lib). First-seen skill name wins.
- `src/discover.js` fetches `GET {baseUrl}/models` (OpenAI-compatible; Anthropic uses `x-api-key` + `anthropic-version`; Ollama falls back to `/api/tags`) and resolves `${ENV_VAR}` references in base_url/api_key before calling.

### Install flow (src/install.js)

Custom `whichCommand` implementation (no external `which` dep): scans PATH plus well-known extra dirs (WindowsApps, scoop shims, `%APPDATA%\npm`, homebrew paths, WinGet Links, go/bin). Windows PATHEXT lookup tries lower/upper case variants because CI filesystems are case-sensitive (this was a real bug — keep `pathextVariants`/`existingFile` behavior). `.cmd`/`.bat` files must spawn via `cmd /d /s /c` with `windowsVerbatimArguments`. Priority: win32 winget → scoop → npm; others brew → npm. Installer failure output is matched against "already installed"-style phrases (`looksAlreadyDone`). All process/env/fs access is dependency-injected (`{platform, env, fsMod, pathMod, spawnFn, timeoutMs}`) so tests run hermetically; `_resetForTests()` clears the single in-flight install guard.

## Code style & conventions

- CommonJS everywhere, `"use strict"` at top of every file. 2-space indent, double quotes in Node code.
- **Zero runtime dependencies is a feature.** Everything is hand-rolled (HTTP server, fetch via global Node 18 fetch, front-matter parsing, which, atomic write). Don't add npm runtime deps; extend the existing modules instead.
- Node code uses modern JS (const/let, arrow fns, optional chaining, structuredClone). **UI code (`ui/*.js`) is deliberately ES5-ish** (`var`, `function`, no modules, no build step): it must run both inside the Electron renderer and when served over plain HTTP. Keep it that way.
- Naming: snake_case for Crush-schema JSON keys, kebab-case for user-facing option keys and CLI flags, camelCase for JS identifiers.
- Atomic writes only via `src/atomic.js` (temp file + rename, with Windows unlink+rename/copy fallback; mode 0o600 — config may contain API keys).
- All user-facing strings live in `ui/i18n.js` in **both** `en` and `zh` catalogs; static markup uses `data-i18n` / `data-i18n-aria` / `data-i18n-title` attributes. Keep both languages in sync when adding strings. README is bilingual too.

## Testing patterns

- Tests sandbox the filesystem: `mkdtemp` a root with fake `home`, `xdg-config`, `localappdata`, `project` dirs and pass them as a custom `env` object to `load({ projectDir, env, writeScope })`. Never let a test touch the real user config.
- Fixtures live in `test/fixtures/` (`crush.json`, `crushrc`) and cover every config family; keep them exhaustive when schema support grows.
- `test/persist-probe.js` is a two-phase write-then-read consumer of the public API used by `npm run probe` and (in simplified form) `persistProbe()` in session-host, which `/api/self-check` and `--self-check` also use.

## CI / release gotchas

- `.github/workflows/release.yml`: any push to `main` that isn't docs-only (`paths-ignore: **/*.md`, `.gitignore`) **automatically bumps the version, builds all three platforms, and publishes a GitHub Release**. Version in CI is `major.minor.GITHUB_RUN_NUMBER` (see `scripts/next-version.js`); locally it bumps the last git tag.
- Release notes are generated from the last 10 commit subjects (`git log -10 --pretty=format:'- %s (%h)'`) — write commit messages that read well standalone.
- electron-builder `files` allowlist: `electron/`, `src/`, `ui/`, `assets/`, `bin/`, package.json. New top-level dirs won't ship unless added there.
- Icons: Windows needs `assets/icon.ico`; mac/linux use `assets/icon.png` (must be 1024px full-bleed for macOS).

## Non-obvious behaviors worth knowing

- Editing through the UI saves on every operation (`apply` → `save`); there is no explicit save step despite the UI having a Save button (it calls the same `save`).
- Denying a tool writes to `options.disabled_tools`, not `permissions` (only allow lives under `permissions.allowed_tools`).
- `upsertMcp` defaults `type` to `stdio`; `upsertModel` fills cost/context defaults via `defaultModel()` (context_window 128000, default_max_tokens 4096).
- `HOOK_EVENTS` only contains `PreToolUse` — the UI deliberately restricts to what Crush supports.
- Opening `ui/index.html` directly via `file://` without a host shows a hint banner (`api` is null); the app is unusable that way by design.
- `scripts/capture-screenshots.js` is an Electron screenshot generator for `docs/screenshots/` (run manually with `npx electron scripts/capture-screenshots.js`; it stubs the window IPC handlers).
