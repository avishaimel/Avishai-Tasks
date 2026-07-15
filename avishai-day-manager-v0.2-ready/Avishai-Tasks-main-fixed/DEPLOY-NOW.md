# Deploy the corrected build

The folder name remains `avishai-day-manager-v0.2-ready` so your existing Render Blueprint path does not need to change.

Replace the contents of the matching folder in GitHub with this corrected folder, commit to `main`, then in Render:

1. Blueprint → **Manual Sync**
2. Web Service → **Manual Deploy**
3. Choose **Clear build cache & deploy**

Expected public URLs after a successful deploy:

- Health: `https://avishai-day-manager.onrender.com/health`
- MCP: `https://avishai-day-manager.onrender.com/mcp`

The critical fix is the new public-registry `package-lock.json`. Do not keep the old lockfile.
