# AI Assistant v2

A full-stack AI assistant powered by Google Vertex AI (Gemini + Imagen 3), with long-term memory, image generation, notes, and real-world tool access.

---

## Setup

### 1. Clone the repository
```bash
git clone <repo-url>
cd myagent
```

### 2. Configure the backend
```bash
cd backend
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | Your GCP project ID (e.g. `my-project-123`) |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI region — use `us-central1` |
| `OPENWEATHER_API_KEY` | From [openweathermap.org](https://openweathermap.org/api) (free tier) |
| `GOOGLE_CLIENT_ID` | From GCP Console → APIs & Services → OAuth 2.0 Client |
| `GOOGLE_CLIENT_SECRET` | Same OAuth client |
| `GOOGLE_REDIRECT_URI` | Leave as `http://localhost:3001/api/auth/callback` |

### 3. Authenticate with Google Cloud (for Vertex AI)
```bash
gcloud auth application-default login
```

### 4. Install dependencies and run the backend
```bash
cd backend
npm install
node server.js
# Backend runs on http://localhost:3001
```

### 5. Install dependencies and run the frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

### 6. (Optional) Authorize Google Calendar & Gmail
Open in your browser:
```
http://localhost:3001/api/auth/google
```
Sign in with your Google account and grant permission. This only needs to be done once.

---

## Features & How to Use

### Chat
Just type any message. The AI responds with streaming text, and renders Markdown (bold, code blocks, lists, etc.).

You can also attach **images or text files** using the 📎 button — the AI will read and analyze them.

---

### Smart Model Routing
Click **Auto** in the top-right model selector to enable automatic routing. The AI picks the best model per message:

| Condition | Model used |
|---|---|
| Image generation keywords | Imagen 3 |
| Message has an image attachment | Gemini 2.5 Pro |
| Long or complex message (>400 chars, or keywords: `analyze`, `research`, `essay`, `compare`, `explain in detail`) | Gemini 2.5 Pro |
| Everything else | Gemini 2.5 Flash |

You can also manually force **2.5 Pro** or **2.5 Flash** from the header.

---

### Image Generation
Uses **Imagen 3** (Vertex AI). Triggers automatically in **Auto** mode when your message contains:

- `draw` — e.g. *"draw a cat"*
- `paint` — e.g. *"paint a sunset"*
- `sketch` — e.g. *"sketch a robot"*
- `illustrate` — e.g. *"illustrate a dragon"*
- `generate/create/make/show me/give me/produce/render` + `image/picture/photo/illustration/painting/artwork/drawing` — e.g. *"generate an image of a mountain"*, *"create a picture of a forest"*
- `image/picture/photo` + `of/showing/with` — e.g. *"a photo of a cat"*

> Note: Imagen 3 blocks generation of real people's faces per Google's safety policy.

---

### Notes (📝 tab)
Create and edit notes manually in the Notes tab.

You can also ask the AI to manage notes with natural language:

| What to say | Action |
|---|---|
| `"create a note called [title] with [content]"` | Creates a new note |
| `"add [content] to my [title] note"` | Appends to an existing note |
| `"update my [title] note to say [content]"` | Replaces a note's content |
| `"delete my [title] note"` | Deletes a note |

---

### Long-Term Memory (🧠 tab)
The AI **automatically extracts facts** about you from every conversation — no action needed. After each AI reply, the system scans the recent messages for things like preferences, habits, or personal info and saves them.

You can also **explicitly ask the AI to remember something**:
- *"Remember that I prefer Python"*
- *"Remember my major is Computer Science"*
- *"Remember I like dark mode"*

Saved memories are injected into every future conversation as context, so the AI always "knows" you.

To view or delete memories, open the **🧠 Memory** tab.

---

### Weather
Ask about the weather in any city:
- *"What's the weather in Taipei?"*
- *"Is it going to rain in Tokyo?"*
- *"What's the temperature in New York?"*

Requires `OPENWEATHER_API_KEY` in `.env`.

---

### Google Calendar
Ask about your schedule (requires OAuth authorization):
- *"What's on my calendar today?"*
- *"Do I have any events on 2026-05-01?"*

---

### Gmail
Ask about your emails (requires OAuth authorization):
- *"What are my recent emails?"*
- *"Do I have any unread emails about homework?"*
- *"Check my emails from the last 7 days"*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express (port 3001) |
| AI — Chat | Google Vertex AI, Gemini 2.5 Pro / Flash |
| AI — Image | Google Vertex AI, Imagen 3 |
| Tool system | MCP (Model Context Protocol) |
| Vertex AI Auth | Google Application Default Credentials (ADC) |
| Calendar / Gmail Auth | Google OAuth 2.0 |
| Storage | Backend JSON files (chats, notes memory) + localStorage (model preference) |
