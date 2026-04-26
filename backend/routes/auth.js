import { Router } from "express";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_PATH = path.resolve(__dirname, "../data/tokens.json");

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Load tokens from data/tokens.json and set credentials on the oauth2Client.
 * Throws if the tokens file doesn't exist.
 */
export function getAuthClient() {
  if (!fs.existsSync(TOKENS_PATH)) {
    const err = new Error(
      "Google OAuth tokens not found. Please visit /api/auth/google to authorize."
    );
    err.code = "NOT_AUTHORIZED";
    throw err;
  }
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

const router = Router();

// GET /api/auth/google — redirect to Google OAuth consent screen
router.get("/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.redirect(url);
});

// GET /api/auth/callback — exchange code for tokens and save
router.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`<h2>Authorization failed: ${error}</h2>`);
  }

  if (!code) {
    return res.status(400).send("<h2>Missing authorization code.</h2>");
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Persist tokens
    fs.mkdirSync(path.dirname(TOKENS_PATH), { recursive: true });
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf8");

    res.send("<h2>Authorized! You can close this tab.</h2>");
  } catch (err) {
    res.status(500).send(`<h2>Token exchange failed: ${err.message}</h2>`);
  }
});

export default router;
