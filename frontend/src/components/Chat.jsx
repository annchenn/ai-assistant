import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { streamChat } from "../lib/gemini";
import { loadChats, saveChats, createChat } from "../lib/storage";
import "./Chat.css";

export default function Chat() {
  const [chats, setChats]       = useState(() => {
    const saved = loadChats();
    return saved.length ? saved : [createChat()];
  });
  const [activeId, setActiveId] = useState(() => {
    const saved = loadChats();
    return saved.length ? saved[0].id : null;
  });
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const bottomRef               = useRef(null);

  // Keep activeId in sync when chats first load
  useEffect(() => {
    if (!activeId && chats.length) setActiveId(chats[0].id);
  }, []);

  // Persist chats to localStorage
  useEffect(() => { saveChats(chats); }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, activeId]);

  const activeChat = chats.find((c) => c.id === activeId) || chats[0];

  function addChat() {
    const c = createChat();
    setChats((prev) => [c, ...prev]);
    setActiveId(c.id);
    setError(null);
  }

  function deleteChat(id) {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = createChat();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  }

  function updateChat(id, updater) {
    setChats((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput("");

    // Name chat from first user message
    const isFirst = activeChat.messages.filter((m) => m.role === "user").length === 0;
    const chatName = isFirst ? text.slice(0, 36) + (text.length > 36 ? "…" : "") : activeChat.name;

    // Add user message
    updateChat(activeId, (c) => ({
      ...c,
      name: chatName,
      messages: [...c.messages, { role: "user", text }],
    }));

    // Add empty AI bubble for streaming
    updateChat(activeId, (c) => ({
      ...c,
      messages: [...c.messages, { role: "ai", text: "", streaming: true }],
    }));

    setLoading(true);
    try {
      const history = activeChat.messages; // snapshot before new messages
      let fullText  = "";

      for await (const chunk of streamChat(history, text)) {
        fullText += chunk;
        const captured = fullText;
        updateChat(activeId, (c) => {
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = { role: "ai", text: captured, streaming: true };
          return { ...c, messages: msgs };
        });
      }

      // Mark done
      updateChat(activeId, (c) => {
        const msgs = [...c.messages];
        msgs[msgs.length - 1] = { role: "ai", text: fullText, streaming: false };
        return { ...c, messages: msgs };
      });
    } catch (e) {
      console.error("[Chat] stream error:", e);
      setError(e.message);
      // Remove empty streaming bubble
      updateChat(activeId, (c) => ({
        ...c,
        messages: c.messages.filter((m) => !(m.streaming && m.text === "")),
      }));
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const messages = activeChat?.messages || [];

  return (
    <div className="chat">
      {/* ── Sidebar ── */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Chats</span>
          <button className="new-chat-btn" onClick={addChat} title="New chat">+</button>
        </div>
        <div className="chat-list">
          {chats.map((c) => (
            <div
              key={c.id}
              className={`chat-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => { setActiveId(c.id); setError(null); }}
            >
              <span className="chat-item-name">{c.name}</span>
              <button
                className="chat-item-del"
                onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}
                title="Delete"
              >×</button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="chat-main">
        <div className="chat-header">
          <span className="chat-title">💬 {activeChat?.name || "New Chat"}</span>
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-chat">Ask me anything — I remember this conversation!</div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="bubble">
                {m.role === "ai" ? (
                  <>
                    <ReactMarkdown>{m.text || " "}</ReactMarkdown>
                    {m.streaming && <span className="stream-cursor" />}
                  </>
                ) : m.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}

        <div className="input-row">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything… (Enter to send)"
            rows={2}
            disabled={loading}
          />
          <button className="btn btn-primary send-btn" onClick={send} disabled={loading || !input.trim()}>
            Send ↑
          </button>
        </div>
      </div>
    </div>
  );
}
