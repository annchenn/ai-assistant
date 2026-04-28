import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHATS_PATH = path.resolve(__dirname, "../data/chats.json");

function readChats() {
  try { return JSON.parse(fs.readFileSync(CHATS_PATH, "utf8")); }
  catch { return []; }
}

function writeChats(chats) {
  fs.mkdirSync(path.dirname(CHATS_PATH), { recursive: true });
  fs.writeFileSync(CHATS_PATH, JSON.stringify(chats), "utf8");
}

const router = Router();

router.get("/", (req, res) => {
  res.json(readChats());
});

router.put("/", (req, res) => {
  const chats = req.body;
  if (!Array.isArray(chats)) return res.status(400).json({ error: "Expected array" });
  writeChats(chats);
  res.json({ ok: true });
});

export default router;
