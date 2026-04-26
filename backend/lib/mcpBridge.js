import { getToolDefinitions, toolHandlers } from "../mcp/server.js";

/**
 * Convert MCP tool definitions to Gemini-compatible function declarations.
 * MCP tool `parameters` is a zod schema object (key → ZodType).
 * We convert it to a plain JSON Schema object.
 */
export function getGeminiFunctionDeclarations() {
  return getToolDefinitions().map(({ name, description, parameters }) => ({
    name,
    description,
    parameters: zodSchemaToJsonSchema(parameters),
  }));
}

/**
 * Dispatch a Gemini function call to the registered MCP tool handler.
 * @param {string} name
 * @param {object} args
 * @returns {Promise<string>}
 */
export async function dispatchToolCall(name, args) {
  const handler = toolHandlers.get(name);
  if (!handler) {
    throw new Error(`No MCP tool handler registered for: ${name}`);
  }
  const result = await handler(args);
  return result?.content?.[0]?.text ?? JSON.stringify(result);
}

// ---------------------------------------------------------------------------
// Internal: convert a record of zod schemas to a JSON Schema object shape
// ---------------------------------------------------------------------------
function zodSchemaToJsonSchema(zodRecord) {
  // If already a plain JSON Schema object (has `type` key), pass through
  if (zodRecord && typeof zodRecord === "object" && "type" in zodRecord) {
    return zodRecord;
  }

  const properties = {};
  const required = [];

  for (const [key, zodType] of Object.entries(zodRecord || {})) {
    const { jsonType, description, isOptional } = introspectZod(zodType);
    properties[key] = { type: jsonType };
    if (description) properties[key].description = description;
    if (!isOptional) required.push(key);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function introspectZod(zodType) {
  if (!zodType || !zodType._def) {
    return { jsonType: "string", isOptional: false };
  }

  const typeName = zodType._def.typeName;

  // Handle optional wrapper
  if (typeName === "ZodOptional" || typeName === "ZodDefault") {
    const inner = introspectZod(zodType._def.innerType);
    return { ...inner, isOptional: true };
  }

  const typeMap = {
    ZodString: "string",
    ZodNumber: "number",
    ZodBoolean: "boolean",
    ZodArray: "array",
    ZodObject: "object",
    ZodEnum: "string",
  };

  return {
    jsonType: typeMap[typeName] ?? "string",
    description: zodType._def.description ?? undefined,
    isOptional: false,
  };
}
