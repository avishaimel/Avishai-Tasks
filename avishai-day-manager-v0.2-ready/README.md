# Avishai Day Manager v0.2

Private ChatGPT MCP App for managing personal day-to-day tasks with an interactive Hebrew dashboard.

## Status

The app has been upgraded and locally verified with:

- MCP SDK `@modelcontextprotocol/sdk` 1.29
- MCP Apps UI helpers `@modelcontextprotocol/ext-apps` 1.7
- Streamable HTTP transport at `/mcp`
- Interactive `text/html;profile=mcp-app` widget
- Tool/resource metadata compatible with ChatGPT custom MCP plugins
- No authentication (development/private testing only)
- Persistent file storage path configurable through `TASKS_FILE`
- Render Blueprint (`render.yaml`) with a persistent disk

Google Calendar is intentionally not included yet.

## Available tools

- `show_dashboard`
- `list_tasks`
- `create_task`
- `set_task_status`
- `delete_task`

## Local run

```bash
npm ci
npm run check
npm run build
npm start
```

Default URLs:

- MCP: `http://localhost:8787/mcp`
- Health: `http://localhost:8787/health`

## Deploy to Render

Render deployment requires a Git repository and access to your own Render account.

1. Upload this folder to a new private GitHub repository.
2. In Render, choose **New → Blueprint**.
3. Connect the repository containing `render.yaml`.
4. Render will create a Node web service in Frankfurt and attach a 5 GB persistent disk.
5. When prompted for `APP_DOMAIN`, enter the final Render origin, for example:
   `https://avishai-day-manager-xxxx.onrender.com`
   You may also leave it blank for initial private testing.
6. Deploy and wait for `/health` to return `{ "ok": true, ... }`.

The final endpoints will be:

- Deployment: `https://YOUR-SERVICE.onrender.com`
- MCP: `https://YOUR-SERVICE.onrender.com/mcp`
- Health: `https://YOUR-SERVICE.onrender.com/health`

## Connect to ChatGPT

In ChatGPT custom plugin / MCP server setup:

- Name: `Avishai Day Manager`
- Server URL: `https://YOUR-SERVICE.onrender.com/mcp`
- Authentication: **None / No authentication**

Do not choose OAuth in this version.

## Security warning

This version intentionally has no authentication. Anyone who learns the public MCP URL can read or modify the task list. Use it only for initial private testing. Add authentication before storing sensitive information or sharing the endpoint.
