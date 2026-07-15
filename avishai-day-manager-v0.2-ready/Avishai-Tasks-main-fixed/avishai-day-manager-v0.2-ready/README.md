# Avishai Day Manager v0.3

Private ChatGPT MCP app for managing Avishai's personal day-to-day tasks through both chat commands and an interactive Hebrew UI.

## What works

- ChatGPT MCP endpoint at `/mcp` using Streamable HTTP.
- Interactive Hebrew RTL task dashboard.
- List, create, complete, reopen, defer, and delete tasks.
- Shared task storage for both chat tool calls and widget actions.
- Health endpoint at `/health`.
- No authentication yet.
- No Google Calendar integration yet.

## Important deployment fix in this version

The previous `package-lock.json` contained package download URLs from an internal OpenAI build registry. Render could not install from those URLs and npm failed with `Exit handler never called!`.

This version fixes that by:

- Rewriting all lockfile package URLs to `https://registry.npmjs.org/`.
- Adding a project `.npmrc` that explicitly uses the public npm registry.
- Using `npm ci --include=dev` so TypeScript and `@types/node` are installed during the Render build.
- Pinning Node.js to `20.20.2` in `render.yaml`.
- Returning to npm; pnpm is not used.

## Render Blueprint configuration

The repository currently stores this project inside:

```text
avishai-day-manager-v0.2-ready/
```

Therefore the Blueprint path in Render should remain:

```text
avishai-day-manager-v0.2-ready/render.yaml
```

The `rootDir` inside `render.yaml` is also intentionally set to:

```text
avishai-day-manager-v0.2-ready
```

## Deploy on Render

1. Replace the files in the existing GitHub project folder with the corrected files from this package.
2. Commit the changes to the `main` branch.
3. In Render, open the Blueprint and run **Manual Sync** so the service settings are refreshed.
4. Open the web service and select **Manual Deploy → Clear build cache & deploy**.
5. The build log should show:

```text
Requesting Node.js version 20.20.2
Running build command 'npm ci --include=dev --registry=https://registry.npmjs.org/ --no-audit --no-fund && npm run build'
```

6. After deployment, verify:

```text
https://avishai-day-manager.onrender.com/health
```

Expected response:

```json
{"ok":true,"app":"Avishai Day Manager","version":"0.3.0"}
```

The MCP URL for ChatGPT is:

```text
https://avishai-day-manager.onrender.com/mcp
```

Use **No authentication / None** when connecting this development server.

## Local verification

Requires Node.js 20 or newer.

```bash
npm ci
npm run check
npm run build
npm start
```

Then open:

```text
http://localhost:8787/health
```

## Storage warning

The Render Free service stores tasks at `/tmp/tasks.json`. This is temporary storage and may reset after a restart or redeploy. It is suitable for initial testing only. A database or persistent storage should be added before relying on it for permanent task history.
