export const AVAILABLE_MODELS = [
  { id: "auto",                                 label: "Auto",           desc: "Smart routing" },
  { id: "gemini-2.5-pro",                       label: "2.5 Pro",        desc: "Most capable" },
  { id: "gemini-2.5-flash",                     label: "2.5 Flash",      desc: "Fast & smart" },
  { id: "gemini-2.5-flash-lite-preview-06-17",  label: "2.5 Flash Lite", desc: "Fastest" },
];

const IMAGE_GEN_RE = /\b(generate|draw|create an? image|paint|illustrate|picture of)\b/i;

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
    return { model: "gemini-3.1-flash-image-preview", isImageGen: true };
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

  // 4. Short simple factual query
  if (
    message.length < 60 &&
    /^(what|who|when|where|define|translate)\b/i.test(message)
  ) {
    return { model: "gemini-2.5-flash-lite-preview-06-17", isImageGen: false };
  }

  // 5. Default
  return { model: "gemini-2.5-flash", isImageGen: false };
}
