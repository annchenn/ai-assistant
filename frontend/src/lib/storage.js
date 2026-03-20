import { v4 as uuid } from "uuid";

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
