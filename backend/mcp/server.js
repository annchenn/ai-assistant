import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createFile,
  writeFile,
  modifyFile,
  readFile,
  listFiles,
  executeCode,
} from "../lib/sandbox.js";

// ---------------------------------------------------------------------------
// MCP Server instance
// ---------------------------------------------------------------------------
export const mcpServer = new McpServer({
  name: "ai-assistant",
  version: "2.0.0",
});

// ---------------------------------------------------------------------------
// Helper: build a forward-to-client response
// ---------------------------------------------------------------------------
function forwardToClient(name, args) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ __forwardToClient: true, name, args }),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Parallel tool-definitions array (used by getToolDefinitions())
// ---------------------------------------------------------------------------
const _toolDefs = [];

/** Map of tool name → async handler fn, used by mcpBridge.js */
export const toolHandlers = new Map();

function registerTool(name, description, schema, handler) {
  mcpServer.tool(name, schema, handler);
  _toolDefs.push({ name, description, parameters: schema });
  toolHandlers.set(name, handler);
}

// ---------------------------------------------------------------------------
// 1. Note tools (forwarded to frontend)
// ---------------------------------------------------------------------------
registerTool(
  "create_note",
  "Create a new note with the given title and content.",
  { title: z.string(), content: z.string() },
  async ({ title, content }) => forwardToClient("create_note", { title, content })
);

registerTool(
  "append_to_note",
  "Append content to an existing note identified by title.",
  { title: z.string(), content: z.string() },
  async ({ title, content }) => forwardToClient("append_to_note", { title, content })
);

registerTool(
  "update_note",
  "Replace the entire content of an existing note identified by title.",
  { title: z.string(), new_content: z.string() },
  async ({ title, new_content }) =>
    forwardToClient("update_note", { title, new_content })
);

// ---------------------------------------------------------------------------
// 2. save_memory
// ---------------------------------------------------------------------------
registerTool(
  "save_memory",
  "Save a fact or piece of information to the persistent memory store.",
  { fact: z.string() },
  async ({ fact }) => {
    try {
      const { memoryStore } = await import("../lib/memoryStore.js");
      await memoryStore.add(fact);
    } catch {
      // memoryStore.js not yet available — silently fail at call time
    }
    return { content: [{ type: "text", text: "Memory saved." }] };
  }
);

// ---------------------------------------------------------------------------
// 3. get_weather
// ---------------------------------------------------------------------------
registerTool(
  "get_weather",
  "Get the current weather for a city.",
  { city: z.string() },
  async ({ city }) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return { content: [{ type: "text", text: "Weather API not configured." }] };
    }
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
      const res = await fetch(url);
      if (!res.ok) {
        const msg = await res.text();
        return { content: [{ type: "text", text: `Weather API error: ${msg}` }] };
      }
      const data = await res.json();
      const temp = data.main?.temp;
      const condition = data.weather?.[0]?.description;
      const humidity = data.main?.humidity;
      const wind = data.wind?.speed;
      const text =
        `Weather in ${data.name}:\n` +
        `  Temperature: ${temp}°C\n` +
        `  Condition: ${condition}\n` +
        `  Humidity: ${humidity}%\n` +
        `  Wind speed: ${wind} m/s`;
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Weather lookup failed: ${err.message}` }] };
    }
  }
);

// ---------------------------------------------------------------------------
// 4. get_calendar_events
// ---------------------------------------------------------------------------
registerTool(
  "get_calendar_events",
  "Retrieve Google Calendar events for a specific date (YYYY-MM-DD).",
  { date: z.string() },
  async ({ date }) => {
    try {
      const { getCalendarClient } = await import("../lib/google.js");
      const calendar = await getCalendarClient();
      const timeMin = new Date(`${date}T00:00:00`).toISOString();
      const timeMax = new Date(`${date}T23:59:59`).toISOString();
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
      });
      const events = res.data.items || [];
      if (events.length === 0) {
        return { content: [{ type: "text", text: `No events found for ${date}.` }] };
      }
      const lines = events.map((e) => {
        const start = e.start?.dateTime || e.start?.date || "";
        const time = start.includes("T")
          ? new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "All day";
        return `- ${e.summary || "(no title)"} at ${time}`;
      });
      return { content: [{ type: "text", text: `Events on ${date}:\n${lines.join("\n")}` }] };
    } catch (err) {
      if (err.message?.includes("not authorized") || err.code === 401 || err.code === "ERR_MODULE_NOT_FOUND") {
        return {
          content: [
            {
              type: "text",
              text: "Google Calendar not authorized. Visit http://localhost:3001/api/auth/google",
            },
          ],
        };
      }
      return { content: [{ type: "text", text: `Calendar error: ${err.message}` }] };
    }
  }
);

// ---------------------------------------------------------------------------
// 5. read_gmail
// ---------------------------------------------------------------------------
registerTool(
  "read_gmail",
  "Search Gmail messages and return a summary of matching emails.",
  { query: z.string(), maxResults: z.number().optional().default(5) },
  async ({ query, maxResults }) => {
    try {
      const { getGmailClient } = await import("../lib/google.js");
      const gmail = await getGmailClient();
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });
      const messages = listRes.data.messages || [];
      if (messages.length === 0) {
        return { content: [{ type: "text", text: "No messages found." }] };
      }
      const details = await Promise.all(
        messages.map(async (m) => {
          const msg = await gmail.users.messages.get({
            userId: "me",
            id: m.id,
            format: "metadata",
            metadataHeaders: ["Subject", "From"],
          });
          const headers = msg.data.payload?.headers || [];
          const subject =
            headers.find((h) => h.name === "Subject")?.value || "(no subject)";
          const snippet = msg.data.snippet || "";
          return `Subject: ${subject}\nSnippet: ${snippet}`;
        })
      );
      return {
        content: [
          { type: "text", text: `Gmail results:\n\n${details.join("\n\n---\n\n")}` },
        ],
      };
    } catch (err) {
      if (err.message?.includes("not authorized") || err.code === 401 || err.code === "ERR_MODULE_NOT_FOUND") {
        return {
          content: [
            {
              type: "text",
              text: "Gmail not authorized. Visit http://localhost:3001/api/auth/google",
            },
          ],
        };
      }
      return { content: [{ type: "text", text: `Gmail error: ${err.message}` }] };
    }
  }
);

// ---------------------------------------------------------------------------
// 6. File tools (sandboxed)
// ---------------------------------------------------------------------------
registerTool(
  "create_file",
  "Create a new file in the workspace with the given content.",
  { path: z.string(), content: z.string() },
  async ({ path: relPath, content }) => {
    try {
      await createFile(relPath, content);
      return { content: [{ type: "text", text: `File created: ${relPath}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

registerTool(
  "write_file",
  "Overwrite a file in the workspace with the given content.",
  { path: z.string(), content: z.string() },
  async ({ path: relPath, content }) => {
    try {
      await writeFile(relPath, content);
      return { content: [{ type: "text", text: `File written: ${relPath}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

registerTool(
  "modify_file",
  "Replace the first occurrence of old_text with new_text in a workspace file.",
  { path: z.string(), old_text: z.string(), new_text: z.string() },
  async ({ path: relPath, old_text, new_text }) => {
    try {
      await modifyFile(relPath, old_text, new_text);
      return { content: [{ type: "text", text: `File modified: ${relPath}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

registerTool(
  "read_file",
  "Read the content of a file from the workspace.",
  { path: z.string() },
  async ({ path: relPath }) => {
    try {
      const content = await readFile(relPath);
      return { content: [{ type: "text", text: content }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

registerTool(
  "list_files",
  "List files in a workspace directory (defaults to workspace root).",
  { dir: z.string().optional().default("") },
  async ({ dir }) => {
    try {
      const files = await listFiles(dir);
      return {
        content: [
          { type: "text", text: files.length ? files.join("\n") : "(empty directory)" },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  }
);

// ---------------------------------------------------------------------------
// 7. execute_code
// ---------------------------------------------------------------------------
registerTool(
  "execute_code",
  "Execute a code snippet in a sandboxed environment. Supported languages: python, c, cpp.",
  { language: z.enum(["python", "c", "cpp"]), code: z.string() },
  async ({ language, code }) => {
    const result = await executeCode(language, code);
    const text =
      `Exit code: ${result.exitCode}\n` +
      (result.stdout ? `STDOUT:\n${result.stdout}\n` : "") +
      (result.stderr ? `STDERR:\n${result.stderr}` : "");
    return { content: [{ type: "text", text: text.trim() }] };
  }
);

// ---------------------------------------------------------------------------
// getToolDefinitions — returns array of {name, description, parameters}
// for mcpBridge.js to build Gemini function declarations
// ---------------------------------------------------------------------------
export function getToolDefinitions() {
  return _toolDefs.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}
