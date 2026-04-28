import express from "express";
import { routeModel } from "../lib/router.js";
import { generateContentStream } from "../lib/vertexai.js";
import { getGeminiFunctionDeclarations, dispatchToolCall } from "../lib/mcpBridge.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
  const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  console.log("[chat] POST received | PROJECT:", PROJECT, "| LOCATION:", LOCATION);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  function send(obj) {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  }

  try {
    const {
      history = [],
      message,
      attachments = [],
      notes = [],
      model: requestedModel = "auto",
      memories = [],
    } = req.body;

    // 1. Route model
    const { model, isImageGen } = routeModel(message, attachments, requestedModel);
    send({ type: "meta", model });

    // 2. Build system prompt
    const notesList = notes.length
      ? notes.map((n) => `- "${n.title}": ${n.content.slice(0, 120)}`).join("\n")
      : "(no notes)";
    const memoriesList = memories.length
      ? memories.map((m) => `- ${m.fact}`).join("\n")
      : "(none)";
    const systemText = `You are a helpful AI assistant with access to the user's notes and long-term memory.

User's notes:
${notesList}

What you know about the user:
${memoriesList}

Use tools when appropriate. For notes, only modify them when explicitly asked.`;

    // 3. Build contents array
    const contents = [
      ...history
        .filter((m) => !m.streaming)
        .map((m) => ({
          role: m.role === "ai" ? "model" : "user",
          parts: [{ text: m.text || "" }],
        })),
    ];

    const userParts = [];
    if (message) userParts.push({ text: message });
    for (const att of attachments) {
      if (att.type === "image") {
        userParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
      } else {
        userParts.push({ text: `\n\n[File: ${att.name}]\n${att.content}` });
      }
    }
    if (userParts.length) contents.push({ role: "user", parts: userParts });

    // 4. Imagen 3 image generation (separate predict API)
    if (isImageGen) {
      const { GoogleAuth } = await import("google-auth-library");
      const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const token = await auth.getAccessToken();
      const imagenUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/imagen-3.0-generate-002:predict`;
      const imagenRes = await fetch(imagenUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [{ prompt: message }], parameters: { sampleCount: 1 } }),
      });
      if (!imagenRes.ok) {
        const errText = await imagenRes.text();
        throw new Error(`Imagen API error ${imagenRes.status}: ${errText.slice(0, 200)}`);
      }
      const imagenData = await imagenRes.json();
      const b64 = imagenData.predictions?.[0]?.bytesBase64Encoded;
      const mime = imagenData.predictions?.[0]?.mimeType || "image/png";
      if (b64) {
        send({ type: "image", image: b64, mimeType: mime });
      } else {
        send({ type: "text", text: "Image generation was blocked by safety filters. Try a different prompt." });
      }
      send({ type: "done" });
      return;
    }

    // 5. Regular Gemini chat — stream loop with function calling
    const toolDecls = getGeminiFunctionDeclarations();
    console.log("[chat] tools available:", toolDecls.map(t => t.name));

    let loopContents = [...contents];

    while (true) {
      console.log(`[chat] → model=${model} contents=${loopContents.length} tools=${toolDecls.length}`);

      let streamResult;
      try {
        streamResult = await generateContentStream({
          model,
          contents: loopContents,
          config: {
            systemInstruction: systemText,
            thinkingConfig: { thinkingBudget: 0 },
            ...(toolDecls.length ? { tools: [{ functionDeclarations: toolDecls }] } : {}),
          },
        });
      } catch (apiErr) {
        console.error("[chat] generateContentStream threw:", apiErr.message);
        throw apiErr;
      }

      let modelParts = [];
      let functionCallData = null;
      let chunkCount = 0;

      for await (const chunk of streamResult) {
        chunkCount++;
        const candidate = chunk.candidates?.[0];
        if (!candidate) continue;

        console.log(`[chat] chunk ${chunkCount} finishReason=${candidate.finishReason} parts=${JSON.stringify(candidate.content?.parts || []).slice(0, 200)}`);

        for (const part of candidate.content?.parts || []) {
          if (part.text) {
            send({ type: "text", text: part.text });
            const existing = modelParts.find((p) => "text" in p);
            if (existing) existing.text += part.text;
            else modelParts.push({ text: part.text });
          }
          if (part.inlineData) {
            send({ type: "image", image: part.inlineData.data, mimeType: part.inlineData.mimeType });
            modelParts.push({ inlineData: part.inlineData });
          }
          if (part.functionCall) {
            functionCallData = part.functionCall;
            modelParts.push({ functionCall: part.functionCall });
          }
        }
      }

      console.log(`[chat] stream ended after ${chunkCount} chunks, functionCall=${functionCallData?.name ?? "none"}`);

      if (!functionCallData) break;

      const { name, args } = functionCallData;
      console.log("[chat] dispatching tool:", name, JSON.stringify(args).slice(0, 200));

      if (["create_note", "append_to_note", "update_note", "delete_note"].includes(name)) {
        send({ type: "noteOp", name, args });
        loopContents = [
          ...loopContents,
          { role: "model", parts: modelParts },
          { role: "user", parts: [{ functionResponse: { name, response: { result: "Done." } } }] },
        ];
      } else {
        let toolResult;
        try {
          toolResult = await dispatchToolCall(name, args);
        } catch (e) {
          toolResult = `Error: ${e.message}`;
        }
        console.log("[chat] tool result:", String(toolResult).slice(0, 200));

        loopContents = [
          ...loopContents,
          { role: "model", parts: modelParts },
          { role: "user", parts: [{ functionResponse: { name, response: { result: toolResult } } }] },
        ];
      }

      functionCallData = null;
      modelParts = [];
    }

    send({ type: "done" });
  } catch (err) {
    send({ type: "error", error: err.message });
  } finally {
    res.end();
  }
});

export default router;
