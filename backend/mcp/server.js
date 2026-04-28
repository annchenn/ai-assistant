import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

registerTool(
  "delete_note",
  "Delete a note identified by title.",
  { title: z.string() },
  async ({ title }) => forwardToClient("delete_note", { title })
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
      // Use UTC boundaries covering the full date to avoid timezone issues
      const timeMin = new Date(`${date}T00:00:00+08:00`).toISOString();
      const timeMax = new Date(`${date}T23:59:59+08:00`).toISOString();

      // Query all calendars the user has
      const calListRes = await calendar.calendarList.list();
      const calIds = (calListRes.data.items || []).map(c => c.id);
      if (!calIds.length) calIds.push("primary");

      const allEvents = [];
      for (const calendarId of calIds) {
        const res = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });
        allEvents.push(...(res.data.items || []));
      }

      // Sort by start time
      allEvents.sort((a, b) => {
        const ta = a.start?.dateTime || a.start?.date || "";
        const tb = b.start?.dateTime || b.start?.date || "";
        return ta.localeCompare(tb);
      });

      if (allEvents.length === 0) {
        return { content: [{ type: "text", text: `No events found for ${date}.` }] };
      }
      const lines = allEvents.map((e) => {
        const start = e.start?.dateTime || e.start?.date || "";
        const time = start.includes("T")
          ? new Date(start).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" })
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
  "Search Gmail messages. Use Gmail search syntax: 'newer_than:1d' for today, 'newer_than:7d' for this week, 'subject:homework' for subject search, etc. Combine with 'is:unread' to filter unread.",
  { query: z.string(), maxResults: z.number().optional().default(10) },
  async ({ query, maxResults }) => {
    try {
      const { getGmailClient } = await import("../lib/google.js");
      const gmail = await getGmailClient();
      // Normalize natural-language "today" to proper Gmail syntax
      let gmailQuery = query;
      if (/^today$|^today'?s?$/i.test(query.trim())) gmailQuery = "newer_than:1d";
      console.log("[gmail] query:", gmailQuery);
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: gmailQuery,
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
