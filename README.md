# My AI Assistant

A browser-based AI assistant powered by Google Gemini.

## Live Demo

> **https://annchenn.github.io/ai-assistant/**

No installation needed — just open the link in your browser.

### Getting Started

1. Go to [https://annchenn.github.io/ai-assistant/](https://annchenn.github.io/ai-assistant/)
2. Enter your **Gemini API key** ([get one free here](https://aistudio.google.com/app/apikey))
3. Start chatting!

Your API key is stored only in your browser's localStorage and is sent directly to the Gemini API — it never passes through any server.

---

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

---

## Tech Stack

- **React** (Vite)
- **Google Gemini API** — streaming + function calling
- **localStorage** — all data stored client-side, no backend
