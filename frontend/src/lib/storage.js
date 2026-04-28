import { v4 as uuid } from "uuid";

// ── Model ──────────────────────────────────────────────
export function loadModel() {
  return localStorage.getItem("gemini_model") || null;
}
export function saveModel(model) {
  localStorage.setItem("gemini_model", model);
}

// ── Chats ─────────────────────────────────────────────
export function loadChats() {
  try { return JSON.parse(localStorage.getItem("chats") || "[]"); }
  catch { return []; }
}

export function saveChats(chats) {
  // Strip binary image data before persisting — base64 images can exceed localStorage's 5MB limit
  const slim = chats.map(c => ({
    ...c,
    messages: c.messages.map(m => ({
      ...m,
      images: m.images?.map(img => ({ mimeType: img.mimeType })), // keep mime, drop data
      attachments: m.attachments?.map(a => a.type === "image" ? { type: "image", name: a.name } : a),
    })),
  }));
  try {
    localStorage.setItem("chats", JSON.stringify(slim));
  } catch {
    // If still too large, save without messages
    localStorage.setItem("chats", JSON.stringify(slim.map(c => ({ ...c, messages: [] }))));
  }
}

export function createChat() {
  return { id: uuid(), name: "New Chat", messages: [] };
}

// ── Notes ─────────────────────────────────────────────
export function loadNotes() {
  try { return JSON.parse(localStorage.getItem("notes") || "[]"); }
  catch { return []; }
}

export function saveNotes(notes) {
  localStorage.setItem("notes", JSON.stringify(notes));
}

export function createNote(title, content) {
  return { id: uuid(), title, content };
}
