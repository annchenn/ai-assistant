import "dotenv/config";
import express from "express";
import cors from "cors";
import { AVAILABLE_MODELS } from "./lib/router.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// GET /api/models — inline handler
app.get("/api/models", (req, res) => {
  res.json(AVAILABLE_MODELS);
});

// Mount route modules (stub files that return 501 for now)
try {
  const { default: chatRouter } = await import("./routes/chat.js");
  app.use("/api/chat", chatRouter);
} catch (err) {
  console.warn("Warning: could not load /routes/chat.js —", err.message);
}

try {
  const { default: memoryRouter } = await import("./routes/memory.js");
  app.use("/api/memory", memoryRouter);
} catch (err) {
  console.warn("Warning: could not load /routes/memory.js —", err.message);
}

try {
  const { default: authRouter } = await import("./routes/auth.js");
  app.use("/api/auth", authRouter);
} catch (err) {
  console.warn("Warning: could not load /routes/auth.js —", err.message);
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on :${PORT}`);
});
