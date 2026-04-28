import { Router } from "express";
import { getAll, add, remove } from "../lib/memoryStore.js";

const router = Router();

// GET /api/memory — list all memories
router.get("/", (req, res) => {
  try {
    res.json(getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/memory — add a memory
router.post("/", (req, res) => {
  const { fact } = req.body ?? {};
  if (!fact || typeof fact !== "string") {
    return res.status(400).json({ error: "fact is required" });
  }
  try {
    const entry = add(fact);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/memory/:id — remove a memory
router.delete("/:id", (req, res) => {
  try {
    remove(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/memory/extract — extract facts from conversation messages
router.post("/extract", async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const transcript = messages
      .map((m) => `${m.role}: ${m.text}`)
      .join("\n");

    const { generateContent } = await import("../lib/vertexai.js");
    const prompt =
      "Extract factual statements about the user from this conversation as a JSON array of strings. " +
      "Only include facts explicitly stated. Return [] if none.\n\n" +
      transcript;

    const result = await generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    // Strip markdown code fences if present
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let facts = [];
    try {
      facts = JSON.parse(jsonText);
      if (!Array.isArray(facts)) facts = [];
    } catch {
      facts = [];
    }

    const existing = getAll();
    let extracted = 0;

    for (const fact of facts) {
      if (typeof fact !== "string" || !fact.trim()) continue;
      // Skip if similar fact already exists (substring check)
      const duplicate = existing.some(
        (m) => m.fact.includes(fact) || fact.includes(m.fact)
      );
      if (!duplicate) {
        add(fact.trim());
        extracted++;
      }
    }

    res.json({ extracted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
