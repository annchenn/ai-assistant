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
  localStorage.setItem("chats", JSON.stringify(chats));
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
