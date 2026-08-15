(function (root) {
  "use strict";
  if (typeof root === "undefined") return;

  var STORAGE_KEY = "crush-setup-lang";

  var en = {
    "app.title": "Crush Setup",
    "brand.sub": "config manager",
    "nav.aria": "Sections",
    "nav.models": "Models",
    "nav.skills": "Skills",
    "nav.mcp": "MCP",
    "nav.lsp": "LSP",
    "nav.hooks": "Hooks",
    "nav.permissions": "Permissions",
    "nav.options": "Options",
    "nav.env": "Env & tools",
    "nav.foot": "auto-saves crush.json / crushrc",
    "scope.global": "Global",
    "scope.project": "Project",
    "project.placeholder": "Project directory",
    "btn.browse": "Browse",
    "btn.reload": "Reload",
    "btn.save": "Save",
    "btn.add": "Add",
    "btn.addSkillPath": "Add skill path",
    "btn.addPath": "Add path",
    "btn.apply": "Apply",
    "btn.enable": "Enable",
    "btn.disable": "Disable",
    "btn.delete": "Delete",
    "btn.edit": "Edit",
    "btn.cancel": "Cancel",
    "empty.detail": "Select an item or click Add.",
    "empty.load": "Load a config to begin.",
    "empty.skills": "No SKILL.md files found in default or extra skill paths.",
    "fileHint": "Opened as file:// without the desktop host. Run `node bin/crush-setup.js` (or `--serve`) so load/save can reach Crush config.",
    "lang.auto": "Auto",
    "lang.zh": "中文",
    "lang.en": "English",
    "lang.label": "Language",
    "win.min": "Minimize",
    "win.max": "Maximize",
    "win.close": "Close",
    "slots.title": "Current models",
    "slot.large": "large model",
    "slot.small": "small model",
    "badge.disabled": "disabled",
    "badge.allow": "allow",
    "badge.deny": "deny",
    "badge.env": "env",
    "models.none": "no custom models",
    "perm.allowSub": "allow — skip prompts",
    "perm.denySub": "deny — hidden from agent",
    "options.cardTitle": "Behavior & UI",
    "options.cardSub": "debug, progress, metrics, paths, option ui…",
    "tools.cardTitle": "tools (ls / grep / glob)",
    "form.provider": "Provider",
    "form.customModels": "Custom models",
    "form.manualModel": "Add model manually",
    "model.add": "Add model",
    "model.needId": "Enter a model id first.",
    "model.needProvider": "Provider ID is required.",
    "model.added": "Added model {id}",
    "model.empty": "No custom models yet. Type an id below, or fetch the list.",
    "model.updated": "Updated model {id}",
    "discover.available": "{n} more from API",
    "discover.imported": "Imported {n} models",
    "form.mcp": "MCP server",
    "form.lsp": "Language server",
    "form.hook": "Hook",
    "form.skill": "Skill",
    "form.skillPath": "Skill path",
    "form.permission": "Permission",
    "form.options": "Options",
    "form.optionUi": "Option UI",
    "form.env": "Environment variable",
    "form.tools": "Tools",
    "field.id": "ID",
    "field.name": "Name",
    "field.type": "Type",
    "field.baseUrl": "Base URL",
    "field.apiKey": "API key",
    "field.systemPromptPrefix": "System prompt prefix",
    "field.disabled": "Disabled",
    "field.flatRate": "Flat rate",
    "field.discoverModels": "Discover models",
    "field.extraHeaders": "Extra headers (KEY=value per line)",
    "field.extraBody": "Extra body JSON",
    "field.customModels": "Custom models on this provider",
    "field.customModelsHint": "Edit models with the fields below, one id per apply.",
    "field.modelId": "Add / update model id",
    "field.modelName": "Model name",
    "field.contextWindow": "Context window",
    "field.defaultMaxTokens": "Default max tokens",
    "field.canReason": "Can reason",
    "field.supportsImages": "Supports images",
    "field.priceIn": "Price in / 1M",
    "field.priceOut": "Price out / 1M",
    "field.transport": "Transport",
    "field.command": "Command",
    "field.args": "Args (one per line)",
    "field.envKv": "Env KEY=value",
    "field.url": "URL",
    "field.headers": "Headers KEY=value",
    "field.timeout": "Timeout (s)",
    "field.disabledTools": "Disabled tools (one per line)",
    "field.enabledTools": "Enabled tools (one per line)",
    "field.oauth": "OAuth",
    "field.oauthClientId": "OAuth client id",
    "field.oauthClientSecret": "OAuth client secret",
    "field.oauthCallbackPort": "OAuth callback port",
    "field.filetypes": "Filetypes (one per line)",
    "field.rootMarkers": "Root markers",
    "field.initOptions": "Init options JSON",
    "field.optionsJson": "Options JSON",
    "field.event": "Event",
    "field.matcher": "Matcher",
    "field.description": "Description",
    "field.source": "Source",
    "field.path": "Path",
    "field.directory": "Directory",
    "field.tool": "Tool",
    "field.kind": "Kind",
    "field.key": "Key",
    "field.value": "Value",
    "field.contextPaths": "context-path (one per line)",
    "field.globalContextPaths": "global-context-path",
    "field.skillPaths": "skill-path",
    "field.disableSkill": "disable-skill",
    "err.extraBodyJson": "extra body must be JSON",
    "err.noHost": "No persist host. Launch via crush-setup.",
    "status.loaded": "Loaded {n} file(s). Write → {path}",
    "status.saved": "Saved {path}",
    "status.reloaded": "Reloaded",
    "hint.autosave": "Changes save automatically. Click to write again.",
    "crush.title": "Crush agent",
    "crush.ready": "Crush {version}",
    "crush.missing": "Crush is not installed",
    "crush.via": "Install with {method}",
    "crush.noInstaller": "Need winget, Scoop, Homebrew, or npm",
    "crush.install": "Install Crush",
    "crush.update": "Update Crush",
    "crush.recheck": "Check again",
    "crush.installing": "Installing with {method}…",
    "crush.installingBtn": "Installing…",
    "crush.installWait": "This can take a few minutes.",
    "crush.installOk": "Crush {version} is ready",
    "crush.installFail": "Could not install Crush",
    "crush.busy": "An install is already running",
    "crush.unknownVersion": "installed",
    "crush.pending": "Installed. Restart this app or open a new terminal to refresh PATH.",
    "status.permHint": "Use Add to create a new allow/deny entry.",
    "discover.label": "Fetch models",
    "discover.fetch": "Fetch model list",
    "discover.loading": "Fetching…",
    "discover.ok": "Found {n} models",
    "discover.fail": "Could not fetch models",
    "discover.use": "Fill from selection",
    "discover.importAll": "Import all new",
    "discover.registered": "already added",
    "hint.discover": "Calls the provider /models API (Crush discover). Pick one to fill the fields, or import all.",
    "hint.id": "Provider id used in model references as provider/model.",
    "hint.name": "Display name shown in Crush and this manager.",
    "hint.type": "API format Crush uses to talk to this provider.",
    "hint.base_url": "API endpoint, e.g. https://api.openai.com/v1.",
    "hint.api_key": "Secret or $ENV_VAR. Crush expands variables at load time.",
    "hint.system_prompt_prefix": "Text prepended to the system prompt for this provider.",
    "hint.disable": "Keep the provider in config but do not use it.",
    "hint.flat_rate": "Skip per-token cost tracking (subscription / flat billing).",
    "hint.discover_models": "Fetch and merge models from the provider /v1/models API.",
    "hint.extra_headers": "Extra HTTP headers. Empty values are dropped.",
    "hint.extra_body": "JSON object merged into OpenAI-compatible request bodies.",
    "hint.models_note": "Custom models already registered. Add or update one below, then Apply.",
    "hint.model_id": "Model id as the provider API expects it (the part after provider/).",
    "hint.model_name": "Human-readable model name.",
    "hint.model_ctx": "Context window size in tokens.",
    "hint.model_max": "Default maximum output tokens for this model.",
    "hint.model_reason": "Model can use reasoning / thinking.",
    "hint.model_images": "Model accepts image attachments.",
    "hint.price_in": "Input price per 1M tokens (cost tracking).",
    "hint.price_out": "Output price per 1M tokens (cost tracking).",
    "hint.slot_large": "Default coding / large-task model (model large).",
    "hint.slot_small": "Faster / cheaper model for small tasks (model small).",
    "hint.transport": "stdio runs a local process; http and sse connect to a URL.",
    "hint.command": "Executable for stdio servers (e.g. npx, uvx, gopls).",
    "hint.args": "Arguments passed to the command, one per line.",
    "hint.env": "Environment variables for the child process (KEY=value).",
    "hint.url": "Endpoint for http or sse transports.",
    "hint.headers": "HTTP headers for http/sse. Empty values are dropped.",
    "hint.timeout": "Startup / connect timeout in seconds.",
    "hint.disabled": "Leave the entry in config but do not start or use it.",
    "hint.disabled_tools": "Hide these tools from this MCP server.",
    "hint.enabled_tools": "If set, only these MCP tools are allowed.",
    "hint.oauth": "Enable OAuth 2.1 for HTTP MCP (browser login is not run here).",
    "hint.oauth_client_id": "Pre-registered OAuth client id when dynamic registration is unavailable.",
    "hint.oauth_client_secret": "Optional secret paired with the OAuth client id.",
    "hint.oauth_callback_port": "Fixed localhost port for the OAuth redirect.",
    "hint.filetypes": "File extensions this language server attaches to (go, ts, rs…).",
    "hint.root_markers": "Files that mark the project root (go.mod, package.json…).",
    "hint.init_options": "JSON passed to the LSP initialize request.",
    "hint.options": "JSON server settings sent after initialize.",
    "hint.event": "When the hook runs. Crush currently supports PreToolUse.",
    "hint.matcher": "Regex tested against the tool name. Empty matches every tool.",
    "hint.description": "Skill description from SKILL.md front matter.",
    "hint.source": "Where the skill was discovered (project, user, system).",
    "hint.path": "Folder that contains this SKILL.md.",
    "hint.directory": "Extra directory Crush should scan for SKILL.md trees.",
    "hint.tool": "Built-in tool name, e.g. view, edit, bash, ls, grep.",
    "hint.kind": "Allow skips the permission prompt. Deny hides the tool from the agent.",
    "hint.key": "Environment variable name set when Crush starts.",
    "hint.value": "Value written into the config env map.",
    "hint.debug": "Enable Crush debug logging.",
    "hint.debug_lsp": "Enable extra logging for language servers.",
    "hint.auto_lsp": "Automatically configure LSPs from project root markers.",
    "hint.progress": "Show progress indicators during long operations.",
    "hint.metrics": "Send anonymous usage metrics. Off stores disable_metrics.",
    "hint.auto_summarize": "Automatically summarize long conversations.",
    "hint.provider_auto_update": "Refresh the built-in provider catalog automatically.",
    "hint.default_providers": "Include Crush’s bundled providers. Off means only yours.",
    "hint.data_directory": "Project data/state directory (default .crush).",
    "hint.initialize_as": "Context filename created by crush init (AGENTS.md, CRUSH.md…).",
    "hint.notifications": "How Crush notifies: auto, native, osc, bell, or disabled.",
    "hint.generated_with": "Add a “Generated with Crush” line on commits / PRs.",
    "hint.trailer": "Git trailer style: none, co-authored-by, or assisted-by.",
    "hint.context_paths": "Extra project context files appended for the agent.",
    "hint.global_context_paths": "Extra global context files (usually under ~/.config).",
    "hint.skills_paths": "Additional directories to scan for Agent Skills.",
    "hint.disabled_skills": "Skill names to hide from the agent (disable-skill).",
    "hint.compact": "Use Crush’s compact TUI chat layout.",
    "hint.transparent": "Use the terminal background instead of Crush’s panel fill.",
    "hint.diff": "Unified or side-by-side diffs in the TUI.",
    "hint.scrollbar": "Chat scrollbar: default (auto-hide), always, or never.",
    "hint.max_depth": "Max directory depth for TUI path completions.",
    "hint.max_items": "Max items returned to TUI completions.",
    "hint.ls_depth": "Max depth for the built-in ls tool.",
    "hint.ls_items": "Max entries the ls tool returns.",
    "hint.grep_timeout": "Timeout in seconds for the grep tool.",
    "hint.glob_timeout": "Timeout in seconds for the glob tool.",
  };

  var zh = {
    "app.title": "Crush Setup",
    "brand.sub": "配置管理",
    "nav.aria": "分区",
    "nav.models": "模型",
    "nav.skills": "技能",
    "nav.mcp": "MCP",
    "nav.lsp": "LSP",
    "nav.hooks": "钩子",
    "nav.permissions": "权限",
    "nav.options": "选项",
    "nav.env": "环境与工具",
    "nav.foot": "改完自动保存 crush.json / crushrc",
    "scope.global": "全局",
    "scope.project": "项目",
    "project.placeholder": "项目目录",
    "btn.browse": "浏览",
    "btn.reload": "重新加载",
    "btn.save": "保存",
    "btn.add": "添加",
    "btn.addSkillPath": "添加技能路径",
    "btn.addPath": "添加路径",
    "btn.apply": "应用",
    "btn.enable": "启用",
    "btn.disable": "禁用",
    "btn.delete": "删除",
    "btn.edit": "编辑",
    "btn.cancel": "取消",
    "empty.detail": "选择一项，或点击添加。",
    "empty.load": "先加载一份配置。",
    "empty.skills": "默认目录和额外 skill-path 中没有找到 SKILL.md。",
    "fileHint": "当前是 file://，没有桌面宿主。请运行 `node bin/crush-setup.js`（或 `--serve`）才能读写 Crush 配置。",
    "lang.auto": "自动",
    "lang.zh": "中文",
    "lang.en": "English",
    "lang.label": "语言",
    "win.min": "最小化",
    "win.max": "最大化",
    "win.close": "关闭",
    "slots.title": "当前模型",
    "slot.large": "大模型",
    "slot.small": "小模型",
    "badge.disabled": "已禁用",
    "badge.allow": "允许",
    "badge.deny": "拒绝",
    "badge.env": "环境变量",
    "models.none": "无自定义模型",
    "perm.allowSub": "允许 — 跳过确认",
    "perm.denySub": "拒绝 — 对智能体隐藏",
    "options.cardTitle": "行为与界面",
    "options.cardSub": "debug、progress、metrics、路径、option ui…",
    "tools.cardTitle": "工具（ls / grep / glob）",
    "form.provider": "供应商",
    "form.customModels": "自定义模型",
    "form.manualModel": "手动添加模型",
    "model.add": "添加模型",
    "model.needId": "请先填写模型 id。",
    "model.needProvider": "必须填写供应商 ID。",
    "model.added": "已添加模型 {id}",
    "model.empty": "还没有自定义模型。在下方填写 id，或先拉取列表。",
    "model.updated": "已更新模型 {id}",
    "discover.available": "接口上还有 {n} 个可加入",
    "discover.imported": "已导入 {n} 个模型",
    "form.mcp": "MCP 服务器",
    "form.lsp": "语言服务器",
    "form.hook": "钩子",
    "form.skill": "技能",
    "form.skillPath": "技能路径",
    "form.permission": "权限",
    "form.options": "选项",
    "form.optionUi": "界面选项",
    "form.env": "环境变量",
    "form.tools": "工具",
    "field.id": "ID",
    "field.name": "名称",
    "field.type": "类型",
    "field.baseUrl": "Base URL",
    "field.apiKey": "API 密钥",
    "field.systemPromptPrefix": "系统提示前缀",
    "field.disabled": "已禁用",
    "field.flatRate": "一口价计费",
    "field.discoverModels": "自动发现模型",
    "field.extraHeaders": "额外请求头（每行 KEY=value）",
    "field.extraBody": "额外请求体 JSON",
    "field.customModels": "该供应商上的自定义模型",
    "field.customModelsHint": "用下方字段添加或更新模型，每次应用一个 id。",
    "field.modelId": "添加 / 更新模型 id",
    "field.modelName": "模型名称",
    "field.contextWindow": "上下文窗口",
    "field.defaultMaxTokens": "默认最大输出 token",
    "field.canReason": "支持推理",
    "field.supportsImages": "支持图片",
    "field.priceIn": "输入价格 / 百万 token",
    "field.priceOut": "输出价格 / 百万 token",
    "field.transport": "传输方式",
    "field.command": "命令",
    "field.args": "参数（每行一个）",
    "field.envKv": "环境变量 KEY=value",
    "field.url": "URL",
    "field.headers": "请求头 KEY=value",
    "field.timeout": "超时（秒）",
    "field.disabledTools": "禁用的工具（每行一个）",
    "field.enabledTools": "启用的工具（每行一个）",
    "field.oauth": "OAuth",
    "field.oauthClientId": "OAuth client id",
    "field.oauthClientSecret": "OAuth client secret",
    "field.oauthCallbackPort": "OAuth 回调端口",
    "field.filetypes": "文件类型（每行一个）",
    "field.rootMarkers": "根目录标记",
    "field.initOptions": "初始化选项 JSON",
    "field.optionsJson": "选项 JSON",
    "field.event": "事件",
    "field.matcher": "匹配器",
    "field.description": "描述",
    "field.source": "来源",
    "field.path": "路径",
    "field.directory": "目录",
    "field.tool": "工具",
    "field.kind": "类型",
    "field.key": "键",
    "field.value": "值",
    "field.contextPaths": "context-path（每行一个）",
    "field.globalContextPaths": "global-context-path",
    "field.skillPaths": "skill-path",
    "field.disableSkill": "disable-skill",
    "err.extraBodyJson": "额外请求体必须是 JSON",
    "err.noHost": "没有持久化宿主。请通过 crush-setup 启动。",
    "status.loaded": "已加载 {n} 个文件。写入 → {path}",
    "status.saved": "已保存 {path}",
    "status.reloaded": "已重新加载",
    "hint.autosave": "修改后会自动保存。点击可再写一次。",
    "crush.title": "Crush 智能体",
    "crush.ready": "Crush {version}",
    "crush.missing": "尚未安装 Crush",
    "crush.via": "使用 {method} 安装",
    "crush.noInstaller": "需要 winget、Scoop、Homebrew 或 npm",
    "crush.install": "一键安装 Crush",
    "crush.update": "更新 Crush",
    "crush.recheck": "重新检测",
    "crush.installing": "正在通过 {method} 安装…",
    "crush.installingBtn": "安装中…",
    "crush.installWait": "可能需要几分钟。",
    "crush.installOk": "Crush {version} 已就绪",
    "crush.installFail": "无法安装 Crush",
    "crush.busy": "正在安装，请稍候",
    "crush.unknownVersion": "已安装",
    "crush.pending": "已安装。请重启本应用或新开终端以刷新 PATH。",
    "status.permHint": "请用「添加」新建允许 / 拒绝项。",
    "discover.label": "拉取模型",
    "discover.fetch": "拉取模型列表",
    "discover.loading": "正在拉取…",
    "discover.ok": "找到 {n} 个模型",
    "discover.fail": "无法拉取模型列表",
    "discover.use": "填入选中项",
    "discover.importAll": "导入全部新模型",
    "discover.registered": "已添加",
    "hint.discover": "请求供应商 /models（与 Crush discover 相同）。选一项填入下方字段，或一次导入全部。",
    "hint.id": "供应商 id，模型引用写成 provider/model。",
    "hint.name": "在 Crush 和本工具里显示的名称。",
    "hint.type": "Crush 调用该供应商时使用的 API 格式。",
    "hint.base_url": "API 地址，例如 https://api.openai.com/v1。",
    "hint.api_key": "密钥，或写 $ENV_VAR。Crush 加载时会展开变量。",
    "hint.system_prompt_prefix": "追加到该供应商系统提示前面的文本。",
    "hint.disable": "留在配置里但不使用这个供应商。",
    "hint.flat_rate": "按订阅 / 一口价计费时，跳过按 token 累计费用。",
    "hint.discover_models": "从供应商 /v1/models 自动发现并合并模型。",
    "hint.extra_headers": "额外 HTTP 请求头。空值会被丢掉。",
    "hint.extra_body": "合并进 OpenAI 兼容请求体的 JSON 对象。",
    "hint.models_note": "已登记的自定义模型。在下方填写后点「应用」添加或更新一条。",
    "hint.model_id": "供应商 API 使用的模型 id（provider/ 后面那一段）。",
    "hint.model_name": "给人看的模型名称。",
    "hint.model_ctx": "上下文窗口大小（token 数）。",
    "hint.model_max": "该模型默认的最大输出 token。",
    "hint.model_reason": "模型是否支持推理 / 思考。",
    "hint.model_images": "模型是否接受图片输入。",
    "hint.price_in": "每百万输入 token 的价格，用于费用统计。",
    "hint.price_out": "每百万输出 token 的价格，用于费用统计。",
    "hint.slot_large": "默认的编程 / 大任务模型（model large）。",
    "hint.slot_small": "更快或更便宜的小任务模型（model small）。",
    "hint.transport": "stdio 拉起本地进程；http / sse 连接 URL。",
    "hint.command": "stdio 要执行的程序，如 npx、uvx、gopls。",
    "hint.args": "传给命令的参数，每行一个。",
    "hint.env": "子进程环境变量，每行 KEY=value。",
    "hint.url": "http 或 sse 的服务地址。",
    "hint.headers": "http/sse 的请求头。空值会被丢掉。",
    "hint.timeout": "启动或连接超时，单位秒。",
    "hint.disabled": "留在配置里，但不启动、不使用。",
    "hint.disabled_tools": "屏蔽该 MCP 服务器上的这些工具。",
    "hint.enabled_tools": "若填写，则只允许这些 MCP 工具。",
    "hint.oauth": "为 HTTP MCP 启用 OAuth 2.1（这里只存字段，不跑登录）。",
    "hint.oauth_client_id": "不支持动态注册时，预先登记的 OAuth client id。",
    "hint.oauth_client_secret": "与 client id 配对的可选密钥。",
    "hint.oauth_callback_port": "OAuth 回调使用的固定本机端口。",
    "hint.filetypes": "该语言服务器关联的文件类型，如 go、ts、rs。",
    "hint.root_markers": "用来判断项目根目录的文件，如 go.mod、package.json。",
    "hint.init_options": "传给 LSP initialize 的 JSON。",
    "hint.options": "initialize 之后下发的服务器设置 JSON。",
    "hint.event": "钩子何时触发。Crush 目前支持 PreToolUse。",
    "hint.matcher": "对工具名做匹配的正则。留空表示匹配所有工具。",
    "hint.description": "来自 SKILL.md 前言的技能描述。",
    "hint.source": "技能是从项目、用户还是系统目录发现的。",
    "hint.path": "包含该 SKILL.md 的文件夹。",
    "hint.directory": "额外让 Crush 扫描 SKILL.md 的目录。",
    "hint.tool": "内置工具名，如 view、edit、bash、ls、grep。",
    "hint.kind": "允许会跳过确认；拒绝会把工具对智能体隐藏。",
    "hint.key": "Crush 启动时设置的环境变量名。",
    "hint.value": "写入配置 env 表的值。",
    "hint.debug": "打开 Crush 调试日志。",
    "hint.debug_lsp": "打开语言服务器的额外日志。",
    "hint.auto_lsp": "根据项目根标记自动配置语言服务器。",
    "hint.progress": "长时间操作时显示进度。",
    "hint.metrics": "发送匿名用量统计。关闭会写入 disable_metrics。",
    "hint.auto_summarize": "对话过长时自动摘要。",
    "hint.provider_auto_update": "自动更新内置供应商目录。",
    "hint.default_providers": "是否包含 Crush 自带供应商。关闭后只用你自己配的。",
    "hint.data_directory": "项目数据和状态目录（默认 .crush）。",
    "hint.initialize_as": "crush init 创建的上下文文件名，如 AGENTS.md。",
    "hint.notifications": "通知方式：auto、native、osc、bell 或 disabled。",
    "hint.generated_with": "在提交 / PR 上加上 Generated with Crush 一行。",
    "hint.trailer": "Git trailer 样式：none、co-authored-by 或 assisted-by。",
    "hint.context_paths": "额外提供给智能体的项目上下文文件。",
    "hint.global_context_paths": "额外的全局上下文文件（一般在 ~/.config 下）。",
    "hint.skills_paths": "额外扫描 Agent Skills 的目录。",
    "hint.disabled_skills": "要对智能体隐藏的技能名（disable-skill）。",
    "hint.compact": "使用 Crush 紧凑聊天布局。",
    "hint.transparent": "使用终端背景，而不是 Crush 自己的面板底色。",
    "hint.diff": "TUI 里用统一 diff 还是左右分栏。",
    "hint.scrollbar": "聊天滚动条：default（自动隐藏）、always 或 never。",
    "hint.max_depth": "路径补全最多往下扫几层目录。",
    "hint.max_items": "补全最多返回多少项。",
    "hint.ls_depth": "内置 ls 工具的最大扫描深度。",
    "hint.ls_items": "ls 工具最多返回多少条。",
    "hint.grep_timeout": "grep 工具超时秒数。",
    "hint.glob_timeout": "glob 工具超时秒数。",
  };

  var catalogs = { en: en, zh: zh };
  var current = "en";
  var mode = "auto";

  function readStored() {
    try {
      if (root.localStorage) return root.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
    return null;
  }

  function writeStored(value) {
    try {
      if (!root.localStorage) return;
      if (!value || value === "auto") root.localStorage.removeItem(STORAGE_KEY);
      else root.localStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      // ignore quota / private mode
    }
  }

  function detectFromNavigator(nav) {
    nav = nav || root.navigator || {};
    var list = [];
    if (nav.languages && nav.languages.length) {
      for (var i = 0; i < nav.languages.length; i++) list.push(nav.languages[i]);
    }
    if (nav.language) list.push(nav.language);
    if (nav.userLanguage) list.push(nav.userLanguage);
    for (var j = 0; j < list.length; j++) {
      var tag = String(list[j] || "").toLowerCase();
      if (tag === "zh" || tag.indexOf("zh-") === 0) return "zh";
    }
    return "en";
  }

  function resolveLang(explicit, nav) {
    if (explicit === "zh" || explicit === "en") {
      mode = explicit;
      return explicit;
    }
    mode = "auto";
    return detectFromNavigator(nav);
  }

  function interpolate(template, vars) {
    var out = String(template);
    vars = vars || {};
    return out.replace(/\{(\w+)\}/g, function (_, name) {
      return vars[name] == null ? "" : String(vars[name]);
    });
  }

  function t(key, vars) {
    var table = catalogs[current] || catalogs.en;
    var raw = table[key];
    if (raw == null) raw = catalogs.en[key];
    if (raw == null) return key;
    return interpolate(raw, vars);
  }

  function applyStatic(doc) {
    doc = doc || root.document;
    if (!doc) return;
    if (doc.documentElement) doc.documentElement.lang = current === "zh" ? "zh-CN" : "en";
    if (doc.title !== undefined) doc.title = t("app.title");
    var nodes = doc.querySelectorAll ? doc.querySelectorAll("[data-i18n]") : [];
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }
    var placeholders = doc.querySelectorAll ? doc.querySelectorAll("[data-i18n-placeholder]") : [];
    for (var p = 0; p < placeholders.length; p++) {
      placeholders[p].setAttribute("placeholder", t(placeholders[p].getAttribute("data-i18n-placeholder")));
    }
    var arias = doc.querySelectorAll ? doc.querySelectorAll("[data-i18n-aria]") : [];
    for (var a = 0; a < arias.length; a++) {
      arias[a].setAttribute("aria-label", t(arias[a].getAttribute("data-i18n-aria")));
    }
    var titles = doc.querySelectorAll ? doc.querySelectorAll("[data-i18n-title]") : [];
    for (var h = 0; h < titles.length; h++) {
      titles[h].setAttribute("title", t(titles[h].getAttribute("data-i18n-title")));
    }
    var langBtns = doc.querySelectorAll ? doc.querySelectorAll("[data-lang]") : [];
    for (var b = 0; b < langBtns.length; b++) {
      var val = langBtns[b].getAttribute("data-lang");
      var on = mode === "auto" ? val === "auto" : val === current;
      langBtns[b].classList.toggle("active", on);
    }
  }

  function setLang(next, nav) {
    current = resolveLang(next, nav);
    if (next === "zh" || next === "en") writeStored(next);
    else writeStored(null);
    applyStatic();
    return current;
  }

  function init(nav) {
    var stored = readStored();
    if (stored === "zh" || stored === "en") current = resolveLang(stored, nav);
    else current = resolveLang("auto", nav);
    applyStatic();
    return current;
  }

  root.crushI18n = {
    t: t,
    setLang: setLang,
    init: init,
    detectFromNavigator: detectFromNavigator,
    resolveLang: resolveLang,
    applyStatic: applyStatic,
    catalogs: catalogs,
    get lang() {
      return current;
    },
    get mode() {
      return mode;
    },
  };
})(typeof window !== "undefined" ? window : this);
