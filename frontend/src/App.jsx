import { useState, useEffect } from "react";
import Chat from "./components/Chat";
import Notes from "./components/Notes";
import WordGame from "./components/WordGame";
import ApiKeySetup from "./components/ApiKeySetup";
import { loadApiKey, clearApiKey, loadNotes, saveNotes, loadModel, saveModel } from "./lib/storage";
import { DEFAULT_MODEL } from "./lib/gemini";
import "./App.css";

const TABS = [
  { id: "Chat",      icon: "💬" },
  { id: "Notes",     icon: "📝" },
  { id: "Word Game", icon: "🎮" },
];

export default function App() {
  const [apiKey, setApiKey] = useState(() => loadApiKey());
  const [tab,    setTab]    = useState("Chat");
  // Shared notes state — both Chat (for AI tools) and Notes tab use this
  const [notes,  setNotes]  = useState(() => loadNotes());
  const [model,  setModel]  = useState(() => loadModel() || DEFAULT_MODEL);

  useEffect(() => { saveNotes(notes); }, [notes]);
  useEffect(() => { saveModel(model); }, [model]);

  function handleLogout() { clearApiKey(); setApiKey(null); }

  if (!apiKey) return <ApiKeySetup onDone={setApiKey} />;

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="logo-icon">✦</div>
          <h1>My AI Assistant</h1>
          <button className="btn btn-ghost key-btn" onClick={handleLogout}>🔑 Key</button>
        </div>
        <nav className="tabs">
          {TABS.map(({ id, icon }) => (
            <button key={id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              <span className="tab-icon">{icon}</span>
              <span className="tab-label">{id}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="main">
        {tab === "Chat"      && <Chat apiKey={apiKey} notes={notes} setNotes={setNotes} model={model} setModel={setModel} />}
        {tab === "Notes"     && <Notes notes={notes} setNotes={setNotes} />}
        {tab === "Word Game" && <WordGame />}
      </main>
    </div>
  );
}
