export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-pro",   label: "Gemini 2.5 Pro",   desc: "Most capable, slower" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash",  desc: "Fast & smart (default)" },
  { id: "gemini-2.5-flash-lite-preview-09-2025", label: "Gemini 2.5 Flash Lite", desc: "Fastest, lightest" },
];

export const DEFAULT_MODEL = "gemini-2.5-flash";

function getBase(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model || DEFAULT_MODEL}`;
}

// ── Note tools the AI can call ────────────────────────────────────────────────
export const NOTE_TOOLS = [
  {
    name: "create_note",
    description: "Create a brand-new note with a title and content.",
    parameters: {
      type: "object",
      properties: {
        title:   { type: "string", description: "Note title" },
        content: { type: "string", description: "Note body content" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "append_to_note",
    description: "Append a line or item to an existing note (e.g. add a TODO item to a list).",
    parameters: {
      type: "object",
      properties: {
        title:   { type: "string", description: "Partial or full title of the note to find" },
        content: { type: "string", description: "Text to append" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "update_note",
    description: "Replace the entire content of an existing note.",
    parameters: {
      type: "object",
      properties: {
        title:       { type: "string", description: "Partial or full title of the note to find" },
        new_content: { type: "string", description: "New content to replace the note body" },
      },
      required: ["title", "new_content"],
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildSystemInstruction(notes) {
  const noteList = notes.length
    ? notes.map((n) => `- "${n.title}": ${n.content.slice(0, 120)}${n.content.length > 120 ? "…" : ""}`).join("\n")
    : "(no notes yet)";
  return {
    parts: [{
      text: `You are a helpful AI assistant with access to the user's notes system.
Current notes:
${noteList}

When the user asks you to add, update, create, or modify notes use the provided tools.
For appending items (e.g. "add X to my TODO list") use append_to_note.
After calling a tool, confirm what you did in a friendly short sentence.`,
    }],
  };
}

// ── Main streaming function ───────────────────────────────────────────────────
/**
 * @param {string}   apiKey
 * @param {Array}    history     - [{role, text}]
 * @param {string}   message
 * @param {Array}    attachments - [{type:'image'|'text', mimeType, data, name, content}]
 * @param {Array}    notes       - current notes array (for context)
 * @param {Function} onFunctionCall - async (call) => result  — execute note op
 */
export async function* streamChat(apiKey, history, message, attachments, notes, onFunctionCall, model) {
  // Build user parts
  const userParts = [{ text: message }];
  for (const att of attachments || []) {
    if (att.type === "image") {
      userParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
    } else {
      userParts.push({ text: `\n\n[Attached file: ${att.name}]\n${att.content}` });
    }
  }

  let contents = [
    ...history.filter((m) => !m.streaming).map((m) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: userParts },
  ];

  const hasNotes  = notes && notes.length >= 0 && onFunctionCall;
  const tools     = hasNotes ? [{ functionDeclarations: NOTE_TOOLS }] : undefined;
  const systemIns = hasNotes ? buildSystemInstruction(notes) : undefined;

  // Loop handles multi-turn function calling
  while (true) {
    const body = {
      contents,
      ...(tools      ? { tools }                           : {}),
      ...(systemIns  ? { systemInstruction: systemIns }   : {}),
    };

    const res = await fetch(`${getBase(model)}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";
    let   modelParts      = [];
    let   functionCallData = null;

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") break outer;
        try {
          const json  = JSON.parse(raw);
          const parts = json?.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              yield part.text;
              const existing = modelParts.find((p) => "text" in p);
              if (existing) existing.text += part.text;
              else modelParts.push({ text: part.text });
            }
            if (part.functionCall) {
              functionCallData = part.functionCall;
              modelParts.push({ functionCall: part.functionCall });
            }
          }
        } catch { /* skip malformed */ }
      }
    }

    if (!functionCallData || !onFunctionCall) break;

    // Execute the note function
    const result = await onFunctionCall(functionCallData);

    // Append model turn + function response, then loop for next response
    contents = [
      ...contents,
      { role: "model", parts: modelParts },
      {
        role:  "user",
        parts: [{
          functionResponse: {
            name:     functionCallData.name,
            response: { result: JSON.stringify(result) },
          },
        }],
      },
    ];

    functionCallData = null;
    modelParts       = [];
  }
}

// ── Validate API key ──────────────────────────────────────────────────────────
export async function validateApiKey(apiKey) {
  const res = await fetch(`${getBase()}:generateContent?key=${apiKey}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Invalid API key");
  }
  return true;
}
