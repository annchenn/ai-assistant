const MODEL = "gemini-2.5-flash";
const BASE  = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

export async function* streamChat(apiKey, history, newMessage) {
  const contents = [
    ...(history || []).map((m) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: [{ text: newMessage }] },
  ];

  const res = await fetch(`${BASE}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const json  = JSON.parse(raw);
        const chunk = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (chunk) yield chunk;
      } catch { /* skip */ }
    }
  }
}

export async function validateApiKey(apiKey) {
  const res = await fetch(
    `${BASE}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Invalid API key");
  }
  return true;
}
