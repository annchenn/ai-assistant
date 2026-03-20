import { useState } from "react";
import Chat from "./components/Chat";
import Notes from "./components/Notes";
import WordGame from "./components/WordGame";
import ApiKeySetup from "./components/ApiKeySetup";
import { loadApiKey, clearApiKey } from "./lib/storage";
import "./App.css";

const TABS = [
  { id: "Chat",      icon: "💬" },
  { id: "Notes",     icon: "📝" },
  { id: "Word Game", icon: "🎮" },
];

export default function App() {
  const [apiKey, setApiKey] = useState(() => loadApiKey());
  const [tab,    setTab]    = useState("Chat");

  function handleLogout() {
    clearApiKey();
    setApiKey(null);
  }

  if (!apiKey) {
    return <ApiKeySetup onDone={setApiKey} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="logo-icon">✦</div>
          <h1>My AI Assistant</h1>
          <button
            className="btn btn-ghost"
            style={{ marginLeft: "auto", fontSize: 13 }}
            onClick={handleLogout}
            title="Change API key"
          >
            🔑 Change Key
          </button>
        </div>
        <nav className="tabs">
          {TABS.map(({ id, icon }) => (
            <button
              key={id}
              className={`tab-btn ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {icon} {id}
            </button>
          ))}
        </nav>
      </header>
      <main className="main">
        {tab === "Chat"      && <Chat apiKey={apiKey} />}
        {tab === "Notes"     && <Notes />}
        {tab === "Word Game" && <WordGame />}
      </main>
    </div>
  );
}
