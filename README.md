# Crush Setup

Desktop manager for [Crush](https://github.com/charmbracelet/crush) configuration: providers, models, skills, MCP, LSP, hooks, permissions, options, env, and tools.

## Install

Download the latest build from [Releases](https://github.com/ethanfly/crush-setup/releases).

- Windows: `Crush Setup-*-win-x64.exe` (installer) or portable `.exe`
- Linux: `.AppImage`
- macOS: `.dmg`

## Development

```bash
npm install
npm start
```

```bash
npm test
npm run dist
```

Pushes to `main` bump the version, run tests, build installers, and publish a GitHub Release.

## Config files

Writes Crush-loadable `crush.json` / `crushrc` under `%USERPROFILE%\.config\crush` (global) or the selected project directory.
