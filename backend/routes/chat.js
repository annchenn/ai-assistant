import express from "express";
import { routeModel } from "../lib/router.js";
import { getGenerativeModel } from "../lib/vertexai.js";
import { getGeminiFunctionDeclarations, dispatchToolCall } from "../lib/mcpBridge.js";

const router = express.Router();

router.post("/", async (req, res) => {
  // 1. Set SSE headers
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

    // 2. Route model
    const { model, isImageGen } = routeModel(message, attachments, requestedModel);
    send({ type: "meta", model });

    // 3. Build system prompt
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

    // 4. Build contents array
    const contents = [
      ...history
        .filter((m) => !m.streaming)
        .map((m) => ({
          role: m.role === "ai" ? "model" : "user",
          parts: [{ text: m.text || "" }],
        })),
    ];

    // Add current user message with any attachments
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

    // 5. Build request config
    const genModel = getGenerativeModel(model);
    const requestConfig = {
      contents,
      systemInstruction: { parts: [{ text: systemText }] },
    };

    if (isImageGen) {
      requestConfig.generationConfig = { responseModalities: ["TEXT", "IMAGE"] };
      // No tools for image gen
    } else {
      const toolDecls = getGeminiFunctionDeclarations();
      if (toolDecls.length) {
        requestConfig.tools = [{ functionDeclarations: toolDecls }];
      }
    }

    // 6. Stream loop (handles multi-turn function calling)
    let loopContents = [...contents];

    while (true) {
      const streamResult = await genModel.generateContentStream({
        ...requestConfig,
        contents: loopContents,
      });

      let modelParts = [];
      let functionCallData = null;

      for await (const chunk of streamResult.stream) {
        const candidate = chunk.candidates?.[0];
        if (!candidate) continue;

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

      if (!functionCallData) break;

      // 7. Dispatch tool call
      const { name, args } = functionCallData;

      // Note tools are forwarded to client
      if (["create_note", "append_to_note", "update_note"].includes(name)) {
        send({ type: "noteOp", name, args });
        // Send a placeholder function response so the model can continue
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
