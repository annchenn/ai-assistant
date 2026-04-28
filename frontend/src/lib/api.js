export const BACKEND_URL = "http://localhost:3001";

export async function fetchChats() {
  const res = await fetch(`${BACKEND_URL}/api/chats`);
  return res.json();
}

export async function persistChats(chats) {
  await fetch(`${BACKEND_URL}/api/chats`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chats),
  }).catch(() => {});
}

export const AVAILABLE_MODELS = [
  { id: "auto",              label: "Auto",     desc: "Smart routing" },
  { id: "gemini-2.5-pro",   label: "2.5 Pro",  desc: "Most capable" },
  { id: "gemini-2.5-flash", label: "2.5 Flash", desc: "Fast & smart" },
];

export const DEFAULT_MODEL = "auto";

/**
 * Async generator that streams chat from backend.
 * Yields: string (text chunk) | {image, mimeType} (image) | {noteOp: true, name, args} (note operation)
 * The `onMeta` callback is called with the resolved model name when received.
 */
export async function* streamChat(history, message, attachments, notes, memories, onMeta, model) {
  // Strip binary image data from history to keep request size small
  const cleanHistory = history.map(m => {
    const hasImages = m.images?.length > 0;
    return {
      ...m,
      // If AI message had images but no text, add a placeholder so context isn't empty
      text: m.role === "ai" && hasImages && !m.text ? "[Image generated]" : m.text,
      images: undefined,
      attachments: m.attachments?.map(a => a.type === "image" ? { type: "image", name: a.name } : a),
    };
  });

  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history: cleanHistory, message, attachments, notes, memories, model }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const event = JSON.parse(raw);
        if (event.type === "meta") {
          onMeta?.(event.model);
        } else if (event.type === "text") {
          yield event.text;
        } else if (event.type === "image") {
          yield { image: event.image, mimeType: event.mimeType };
        } else if (event.type === "noteOp") {
          yield { noteOp: true, name: event.name, args: event.args };
        } else if (event.type === "error") {
          throw new Error(event.error);
        }
        // "done" type: just stop naturally
      } catch (e) {
        if (e.message && !e.message.includes("JSON")) throw e;
      }
    }
  }
}

export async function getMemories() {
  const res = await fetch(`${BACKEND_URL}/api/memory`);
  return res.json();
}

export async function extractMemories(messages) {
  await fetch(`${BACKEND_URL}/api/memory/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  }).catch(() => {}); // fire and forget
}

export async function deleteMemory(id) {
  await fetch(`${BACKEND_URL}/api/memory/${id}`, { method: "DELETE" });
}

export async function clearMemories() {
  const mems = await getMemories();
  await Promise.all(mems.map(m => deleteMemory(m.id)));
}
