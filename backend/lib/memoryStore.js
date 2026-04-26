import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { v4 as uuid } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_PATH = path.resolve(__dirname, "../data/memory.json");

function load() {
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, "utf8"));
  } catch {
    return [];
  }
}

function save(data) {
  writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function getAll() {
  return load();
}

export function add(fact) {
  const data = load();
  const entry = { id: uuid(), fact, created_at: new Date().toISOString() };
  data.push(entry);
  save(data);
  return entry;
}

export function remove(id) {
  const data = load().filter((m) => m.id !== id);
  save(data);
}

export function clear() {
  save([]);
}

// Named export as object for backward compat with mcp/server.js dynamic import
export const memoryStore = { getAll, add, remove, clear };
