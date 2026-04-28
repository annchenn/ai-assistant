import "dotenv/config";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in .env");
  return key;
}

export function getStreamUrl(model) {
  return `${BASE}/${model}:streamGenerateContent?alt=sse&key=${getApiKey()}`;
}

export function getGenerateUrl(model) {
  return `${BASE}/${model}:generateContent?key=${getApiKey()}`;
}
