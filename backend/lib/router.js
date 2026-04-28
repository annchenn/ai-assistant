export const AVAILABLE_MODELS = [
  { id: "auto",             label: "Auto",     desc: "Smart routing" },
  { id: "gemini-2.5-pro",  label: "2.5 Pro",  desc: "Most capable" },
  { id: "gemini-2.5-flash", label: "2.5 Flash", desc: "Fast & smart" },
];

const IMAGE_GEN_RE = /\b(draw|paint|sketch|illustrate)\b|\b(generate|create|make|give me|show me|produce|render)\b.{0,30}\b(image|picture|photo|illustration|painting|artwork|drawing)\b|\b(image|picture|photo)\b.{0,20}\b(of|showing|with)\b/i;

/**
 * Route a message to the appropriate model.
 * @param {string} message
 * @param {Array}  attachments  - array of objects with at least a `type` field
 * @param {string} requestedModel
 * @returns {{ model: string, isImageGen: boolean }}
 */
export function routeModel(message, attachments = [], requestedModel = "auto") {
  if (requestedModel && requestedModel !== "auto") {
    return { model: requestedModel, isImageGen: false };
  }

  // 1. Image generation keywords
  if (IMAGE_GEN_RE.test(message)) {
    return { model: "imagen-3.0-generate-002", isImageGen: true };
  }

  // 2. Has image attachments
  if (attachments.some((a) => a.type === "image")) {
    return { model: "gemini-2.5-pro", isImageGen: false };
  }

  // 3. Long or complex message
  if (
    message.length > 400 ||
    /analyze|research|essay|compare|explain in detail/i.test(message)
  ) {
    return { model: "gemini-2.5-pro", isImageGen: false };
  }

  // 4. Short simple factual query — fall through to default Flash

  // 5. Default
  return { model: "gemini-2.5-flash", isImageGen: false };
}
