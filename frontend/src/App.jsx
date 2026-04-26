import { useState, useEffect } from "react";
import Chat from "./components/Chat";
import Notes from "./components/Notes";
import WordGame from "./components/WordGame";
import Memory from "./components/Memory";
import { loadNotes, saveNotes, loadModel, saveModel } from "./lib/storage";
import { DEFAULT_MODEL } from "./lib/api";
import "./App.css";

const TABS = [
  { id: "Chat",      icon: "💬" },
  { id: "Notes",     icon: "📝" },
  { id: "Word Game", icon: "🎮" },
  { id: "Memory",    icon: "🧠" },
];

export default function App() {
  const [tab,      setTab]      = useState("Chat");
  // Shared notes state — both Chat (for AI tools) and Notes tab use this
  const [notes,    setNotes]    = useState(() => loadNotes());
  const [model,    setModel]    = useState(() => loadModel() || DEFAULT_MODEL);
  const [memories, setMemories] = useState([]);

  useEffect(() => { saveNotes(notes); }, [notes]);
  useEffect(() => { saveModel(model); }, [model]);
  useEffect(() => {
    fetch("http://localhost:3001/api/memory").then(r => r.json()).then(setMemories).catch(() => {});
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="logo-icon">✦</div>
          <h1>My AI Assistant</h1>
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
        {tab === "Chat"      && <Chat notes={notes} setNotes={setNotes} model={model} setModel={setModel} memories={memories} />}
        {tab === "Notes"     && <Notes notes={notes} setNotes={setNotes} />}
        {tab === "Word Game" && <WordGame />}
        {tab === "Memory"    && <Memory />}
      </main>
    </div>
  );
}
