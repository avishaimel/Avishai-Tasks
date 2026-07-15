import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

const ROOT = process.cwd();
const SEED_TASKS_FILE = path.join(ROOT, "data/tasks.json");
const TASKS_FILE = process.env.TASKS_FILE ?? SEED_TASKS_FILE;
const WIDGET_FILE = path.join(ROOT, "public/day-manager-widget.html");
const WIDGET_URI = "ui://avishai-day-manager/dashboard-v2.html";
const APP_DOMAIN = process.env.APP_DOMAIN;

type TaskStatus = "open" | "scheduled" | "done" | "deferred";
type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  category: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
};

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  status: z.enum(["open", "scheduled", "done", "deferred"]),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string().nullable(),
});

async function ensureStorage(): Promise<void> {
  await fs.mkdir(path.dirname(TASKS_FILE), { recursive: true });
  try {
    await fs.access(TASKS_FILE);
  } catch {
    await fs.copyFile(SEED_TASKS_FILE, TASKS_FILE);
  }
}

async function readTasks(): Promise<Task[]> {
  await ensureStorage();
  const parsed = JSON.parse(await fs.readFile(TASKS_FILE, "utf8"));
  return z.array(taskSchema).parse(parsed);
}

async function writeTasks(tasks: Task[]): Promise<void> {
  await ensureStorage();
  const temporary = `${TASKS_FILE}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(tasks, null, 2), "utf8");
  await fs.rename(temporary, TASKS_FILE);
}

function dashboardResult(tasks: Task[], message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent: {
      title: "היום שלי",
      timezone: "Asia/Jerusalem",
      tasks,
    },
    _meta: {},
  };
}

function createServer(): McpServer {
  const server = new McpServer(
    { name: "avishai-day-manager", version: "0.3.0" },
    {
      instructions:
        "This app manages Avishai's personal day-to-day tasks. Use show_dashboard when the user asks to see the board. Before changing a task by natural-language reference, call list_tasks to identify the exact task ID. Do not delete a task without explicit confirmation.",
    },
  );

  registerAppResource(
    server,
    "day-manager-dashboard",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await fs.readFile(WIDGET_FILE, "utf8"),
          _meta: {
            "openai/widgetDescription":
              "לוח אינטראקטיבי לניהול משימות וסידורים אישיים בעברית.",
            "openai/widgetPrefersBorder": true,
            ui: {
              prefersBorder: true,
              ...(APP_DOMAIN ? { domain: APP_DOMAIN } : {}),
              csp: { connectDomains: [], resourceDomains: [] },
            },
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "show_dashboard",
    {
      title: "הצג את לוח המשימות",
      description:
        "Use this when the user wants to open or view their personal day-to-day task dashboard.",
      inputSchema: {},
      outputSchema: {
        title: z.string(),
        timezone: z.string(),
        tasks: z.array(taskSchema),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/outputTemplate": WIDGET_URI,
        "openai/toolInvocation/invoking": "פותח את לוח המשימות…",
        "openai/toolInvocation/invoked": "לוח המשימות מוכן",
      },
    },
    async () => dashboardResult(await readTasks(), "הצגתי את לוח המשימות האישי."),
  );

  registerAppTool(
    server,
    "list_tasks",
    {
      title: "הצג משימות",
      description:
        "Use this when the user asks which personal tasks are open, done, scheduled, deferred, or in a particular category.",
      inputSchema: {
        status: z.enum(["open", "scheduled", "done", "deferred"]).optional(),
        category: z.string().optional(),
      },
      outputSchema: { tasks: z.array(taskSchema) },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async ({ status, category }) => {
      let tasks = await readTasks();
      if (status) tasks = tasks.filter((task) => task.status === status);
      if (category) tasks = tasks.filter((task) => task.category === category);
      return {
        content: [{ type: "text" as const, text: `נמצאו ${tasks.length} משימות.` }],
        structuredContent: { tasks },
      };
    },
  );

  registerAppTool(
    server,
    "create_task",
    {
      title: "הוסף משימה",
      description: "Use this when the user wants to add a personal day-to-day task.",
      inputSchema: {
        title: z.string().min(1),
        category: z.string().default("כללי"),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        dueDate: z.string().nullable().optional(),
      },
      outputSchema: {
        title: z.string(),
        timezone: z.string(),
        tasks: z.array(taskSchema),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/outputTemplate": WIDGET_URI,
        "openai/toolInvocation/invoking": "מוסיף משימה…",
        "openai/toolInvocation/invoked": "המשימה נוספה",
      },
    },
    async ({ title, category, priority, dueDate }) => {
      const tasks = await readTasks();
      tasks.push({
        id: randomUUID(),
        title,
        category,
        priority,
        status: "open",
        dueDate: dueDate ?? null,
      });
      await writeTasks(tasks);
      return dashboardResult(tasks, `הוספתי את המשימה: ${title}`);
    },
  );

  registerAppTool(
    server,
    "set_task_status",
    {
      title: "עדכן סטטוס משימה",
      description:
        "Use this when the user or dashboard wants to mark a task done, reopen it, defer it, or mark it scheduled.",
      inputSchema: {
        id: z.string(),
        status: z.enum(["open", "scheduled", "done", "deferred"]),
      },
      outputSchema: {
        title: z.string(),
        timezone: z.string(),
        tasks: z.array(taskSchema),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/outputTemplate": WIDGET_URI,
      },
    },
    async ({ id, status }) => {
      const tasks = await readTasks();
      const task = tasks.find((candidate) => candidate.id === id);
      if (!task) {
        return {
          content: [{ type: "text" as const, text: "המשימה לא נמצאה." }],
          isError: true,
        };
      }
      task.status = status;
      await writeTasks(tasks);
      return dashboardResult(tasks, `עדכנתי את \"${task.title}\".`);
    },
  );

  registerAppTool(
    server,
    "delete_task",
    {
      title: "מחק משימה",
      description:
        "Use this only after the user explicitly confirms that they want to permanently delete a task.",
      inputSchema: { id: z.string() },
      outputSchema: {
        title: z.string(),
        timezone: z.string(),
        tasks: z.array(taskSchema),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/outputTemplate": WIDGET_URI,
      },
    },
    async ({ id }) => {
      const tasks = await readTasks();
      const existing = tasks.find((task) => task.id === id);
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: "המשימה לא נמצאה." }],
          isError: true,
        };
      }
      const next = tasks.filter((task) => task.id !== id);
      await writeTasks(next);
      return dashboardResult(next, `מחקתי את המשימה: ${existing.title}`);
    },
  );

  return server;
}

await ensureStorage();
const app = createMcpExpressApp();
app.disable("x-powered-by");

app.get("/", (_req, res) => {
  res.json({
    name: "Avishai Day Manager",
    version: "0.3.0",
    transport: "MCP Streamable HTTP",
    endpoints: { mcp: "/mcp", health: "/health" },
    authentication: "none",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "Avishai Day Manager", version: "0.3.0" });
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

for (const method of ["get", "delete"] as const) {
  app[method]("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  });
}

const port = Number(process.env.PORT ?? 8787);
const httpServer = app.listen(port, "0.0.0.0", () => {
  console.log(`Avishai Day Manager listening on port ${port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received; shutting down`);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
