import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

let _ai = null;

function getInstance() {
  if (!_ai) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT env var is not set");
    _ai = new GoogleGenAI({ vertexai: true, project, location });
  }
  return _ai;
}

export function generateContentStream(params) {
  return getInstance().models.generateContentStream(params);
}

export function generateContent(params) {
  return getInstance().models.generateContent(params);
}
