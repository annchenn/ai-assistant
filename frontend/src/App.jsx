import { useState, useEffect } from "react";
import Chat from "./components/Chat";
import Notes from "./components/Notes";
import WordGame from "./components/WordGame";
import "./App.css";

const TABS = [
  { id: "Chat", icon: "💬" },
  { id: "Notes", icon: "📝" },
  { id: "Word Game", icon: "🎮" },
];

const API = "http://localhost:8000";

export default function App() {
  const [tab, setTab] = useState("Chat");
  const [online, setOnline] = useState(null);

  useEffect(() => {
    const check = () =>
      fetch(`${API}/api/notes`)
        .then(() => setOnline(true))
        .catch(() => setOnline(false));
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="logo-icon">✦</div>
          <h1>My AI Assistant</h1>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#aeaeb2" }}>
            <span className={`status-dot ${online === true ? "online" : online === false ? "offline" : ""}`} />
            {online === true ? "Connected" : online === false ? "Backend offline" : "Checking…"}
          </span>
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
        {tab === "Chat" && <Chat />}
        {tab === "Notes" && <Notes />}
        {tab === "Word Game" && <WordGame />}
      </main>
    </div>
  );
}
