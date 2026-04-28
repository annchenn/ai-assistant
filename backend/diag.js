#!/usr/bin/env node
// Quick diagnostic: tests Vertex AI auth + API access
// Run: node diag.js
import "dotenv/config";
import { GoogleAuth } from "google-auth-library";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

console.log("PROJECT:", PROJECT);
console.log("LOCATION:", LOCATION);

if (!PROJECT) {
  console.error("ERROR: GOOGLE_CLOUD_PROJECT not set in .env");
  process.exit(1);
}

// Test image gen model
const MODELS_TO_TRY = [
  { loc: "us-central1", model: "gemini-2.0-flash",                      action: "generateContent" },
  { loc: "us-central1", model: "gemini-2.0-flash-001",                  action: "generateContent" },
  { loc: "us-central1", model: "imagen-3.0-generate-002",               action: "predict"         },
  { loc: "us-central1", model: "imagen-3.0-fast-generate-001",          action: "predict"         },
];

const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/gemini-3.1-flash-image-preview:generateContent`;
console.log("URL:", url);

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const token = await auth.getAccessToken();
if (!token) {
  console.error("ERROR: Could not obtain access token. Run: gcloud auth application-default login");
  process.exit(1);
}
console.log("Token obtained:", token.slice(0, 20) + "...\n");

for (const { loc, model, action } of MODELS_TO_TRY) {
  const testUrl = `https://${loc}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${loc}/publishers/google/models/${model}:${action}`;
  const body = action === "predict"
    ? JSON.stringify({ instances: [{ prompt: "A red circle" }], parameters: { sampleCount: 1 } })
    : JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Draw a red circle." }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      });
  try {
    const res = await fetch(testUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body,
    });
    const resBody = await res.text();
    const preview = resBody.slice(0, 150).replace(/\n/g, " ");
    console.log(`[${res.status}] ${loc} / ${model}:${action}`);
    if (res.ok) console.log("  ✅ WORKS!");
    else console.log("  ❌", preview);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }
}
