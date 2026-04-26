import "dotenv/config";
import { VertexAI } from "@google-cloud/vertexai";

const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

let _vertexAI = null;

function getInstance() {
  if (!_vertexAI) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT env var is not set");
    _vertexAI = new VertexAI({ project, location });
  }
  return _vertexAI;
}

export function getGenerativeModel(modelId) {
  return getInstance().getGenerativeModel({ model: modelId });
}

export { getInstance as vertexAI };
