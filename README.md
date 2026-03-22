# My AI Assistant

A browser-based AI assistant powered by Google Gemini, built with React.

## Features

### Chat
- Converse with Gemini AI in a multi-session chat interface
- Streaming responses with a live typing indicator
- Attach images or text files to your messages
- Switch between models: **Gemini 2.5 Pro**, **Gemini 2.5 Flash**, and **Gemini 2.5 Flash Lite**
- Chat history is saved locally in the browser

### Notes
- Create and edit notes directly in the Notes tab
- Ask the AI in Chat to **create**, **append to**, or **update** your notes by natural language
  - e.g. "Add a new note called BFS algo" or "Add milk to my shopping list"

### Word Game
- A simple word-based mini-game for fun

## Getting Started

1. Clone the repo and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

4. Enter your [Gemini API key](https://aistudio.google.com/app/apikey) when prompted. The key is stored only in your browser's localStorage and never sent anywhere except directly to the Gemini API.

## Tech Stack

- **React** (Vite)
- **Google Gemini API** — streaming + function calling
- **localStorage** — all data stored client-side, no backend
