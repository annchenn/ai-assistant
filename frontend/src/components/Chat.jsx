import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { streamChat, AVAILABLE_MODELS } from "../lib/gemini";
import { loadChats, saveChats, createChat, createNote } from "../lib/storage";
import "./Chat.css";

export default function Chat({ apiKey, notes, setNotes, model, setModel }) {
  const [chats,       setChats]       = useState(() => { const s = loadChats(); return s.length ? s : [createChat()]; });
  const [activeId,    setActiveId]    = useState(() => { const s = loadChats(); return s.length ? s[0].id : null; });
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [attachments, setAttachments] = useState([]);   // [{type,name,mimeType?,data?,content?,preview?}]
  const [toast,       setToast]       = useState(null); // {msg, ok}
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef  = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { if (!activeId && chats.length) setActiveId(chats[0].id); }, []);
  useEffect(() => { saveChats(chats); }, [chats]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, activeId, loading]);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Note function-call handler ──────────────────────────────────────────────
  async function handleFunctionCall(call) {
    const { name, args } = call;

    if (name === "create_note") {
      const note = createNote(args.title, args.content);
      setNotes((prev) => [...prev, note]);
      showToast(`📝 Created note "${args.title}"`);
      return { success: true, noteId: note.id };
    }

    if (name === "append_to_note") {
      let found = false;
      setNotes((prev) => prev.map((n) => {
        if (n.title.toLowerCase().includes(args.title.toLowerCase())) {
          found = true;
          return { ...n, content: n.content ? `${n.content}\n${args.content}` : args.content };
        }
        return n;
      }));
      if (found) showToast(`📝 Updated note "${args.title}"`);
      else showToast(`⚠️ Note "${args.title}" not found`, false);
      return { success: found };
    }

    if (name === "update_note") {
      let found = false;
      setNotes((prev) => prev.map((n) => {
        if (n.title.toLowerCase().includes(args.title.toLowerCase())) {
          found = true;
          return { ...n, content: args.new_content };
        }
        return n;
      }));
      if (found) showToast(`📝 Replaced note "${args.title}"`);
      else showToast(`⚠️ Note "${args.title}" not found`, false);
      return { success: found };
    }

    return { error: "Unknown function" };
  }

  // ── File attachment ─────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          const base64  = dataUrl.split(",")[1];
          setAttachments((prev) => [...prev, { type: "image", name: file.name, mimeType: file.type, data: base64, preview: dataUrl }]);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setAttachments((prev) => [...prev, { type: "text", name: file.name, content: ev.target.result }]);
        };
        reader.readAsText(file);
      }
    });
    e.target.value = "";
  }

  function removeAttachment(i) {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Chats ───────────────────────────────────────────────────────────────────
  const activeChat = chats.find((c) => c.id === activeId) || chats[0];

  function addChat() {
    const c = createChat();
    setChats((prev) => [c, ...prev]);
    setActiveId(c.id);
    setError(null);
    setSidebarOpen(false);
  }

  function deleteChat(id) {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (!next.length) { const f = createChat(); setActiveId(f.id); return [f]; }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  }

  function updateChat(id, updater) {
    setChats((prev) => prev.map((c) => c.id === id ? updater(c) : c));
  }

  // ── Send ────────────────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if ((!text && !attachments.length) || loading) return;
    setError(null);
    setInput("");
    const atts = [...attachments];
    setAttachments([]);

    const isFirst  = !activeChat.messages.some((m) => m.role === "user");
    const chatName = isFirst ? (text.slice(0, 36) + (text.length > 36 ? "…" : "")) || atts[0]?.name : activeChat.name;

    const userMsg = { role: "user", text: text || `[${atts.map(a => a.name).join(", ")}]`, attachments: atts };
    const aiMsgId = Date.now();
    updateChat(activeId, (c) => ({ ...c, name: chatName, messages: [...c.messages, userMsg] }));
    updateChat(activeId, (c) => ({ ...c, messages: [...c.messages, { id: aiMsgId, role: "ai", text: "", streaming: true }] }));

    setLoading(true);
    try {
      const history  = activeChat.messages;
      let   fullText = "";

      for await (const chunk of streamChat(apiKey, history, text, atts, notes, handleFunctionCall, model)) {
        fullText += chunk;
        const captured = fullText;
        updateChat(activeId, (c) => {
          const msgs = c.messages.map((m) =>
            m.id === aiMsgId ? { ...m, text: captured, streaming: true } : m
          );
          return { ...c, messages: msgs };
        });
      }

      updateChat(activeId, (c) => {
        const msgs = c.messages.map((m) =>
          m.id === aiMsgId ? { ...m, text: fullText, streaming: false } : m
        );
        return { ...c, messages: msgs };
      });
    } catch (e) {
      console.error("[Chat]", e);
      setError(e.message);
      updateChat(activeId, (c) => ({ ...c, messages: c.messages.filter((m) => !(m.id === aiMsgId && !m.text)) }));
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
      {/* Mobile sidebar overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Chats</span>
          <button className="new-chat-btn" onClick={addChat} title="New chat">+</button>
        </div>
        <div className="chat-list">
          {chats.map((c) => (
            <div key={c.id} className={`chat-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => { setActiveId(c.id); setError(null); setSidebarOpen(false); }}>
              <span className="chat-item-name">{c.name}</span>
              <button className="chat-item-del" onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}>×</button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="chat-main">
        <div className="chat-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen((o) => !o)}>☰</button>
          <span className="chat-title">{activeChat?.name || "New Chat"}</span>
          <div className="model-selector">
            {AVAILABLE_MODELS.map((m) => (
              <button
                key={m.id}
                className={`model-btn ${model === m.id ? "active" : ""}`}
                onClick={() => setModel(m.id)}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-chat">
              Ask me anything, attach images or files, or say<br />
              <em>"add X to my [note name]"</em> to update your notes!
            </div>
          )}
          {messages.filter((m) => !(m.role === "ai" && m.streaming && !m.text)).map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="bubble">
                {m.role === "user" && m.attachments?.length > 0 && (
                  <div className="att-previews">
                    {m.attachments.map((a, j) =>
                      a.type === "image"
                        ? <img key={j} src={a.preview} className="att-img-preview" alt={a.name} />
                        : <span key={j} className="att-file-chip">📄 {a.name}</span>
                    )}
                  </div>
                )}
                {m.role === "ai" ? (
                  <><ReactMarkdown>{m.text}</ReactMarkdown>{m.streaming && <span className="stream-cursor" />}</>
                ) : (
                  m.text && <span>{m.text}</span>
                )}
              </div>
            </div>
          ))}
          {loading && !messages.some((m) => m.streaming && m.text) && (
            <div className="msg ai"><div className="bubble typing"><span /><span /><span /></div></div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}
        {toast  && <div className={`toast ${toast.ok ? "ok" : "warn"}`}>{toast.msg}</div>}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="att-bar">
            {attachments.map((a, i) => (
              <div key={i} className="att-chip">
                {a.type === "image"
                  ? <img src={a.preview} className="att-thumb" alt={a.name} />
                  : <span className="att-chip-icon">📄</span>}
                <span className="att-chip-name">{a.name}</span>
                <button className="att-remove" onClick={() => removeAttachment(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="input-row">
          <input type="file" ref={fileInputRef} multiple accept="image/*,.txt,.md,.csv,.json,.py,.js"
            style={{ display: "none" }} onChange={handleFileChange} />
          <button className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach file" disabled={loading}>📎</button>
          <textarea className="chat-input" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey} placeholder="Ask anything, attach a file, or update a note…" rows={2} disabled={loading} />
          <button className="btn btn-primary send-btn" onClick={send} disabled={loading || (!input.trim() && !attachments.length)}>↑</button>
        </div>
      </div>
    </div>
  );
}
