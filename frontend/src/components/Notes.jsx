import { useState } from "react";
import { createNote } from "../lib/storage";
import "./Notes.css";

export default function Notes({ notes, setNotes }) {
  const [editing, setEditing] = useState(null);
  const [title,   setTitle]   = useState("");
  const [content, setContent] = useState("");

  function startNew()   { setEditing("new"); setTitle(""); setContent(""); }
  function startEdit(n) { setEditing(n); setTitle(n.title); setContent(n.content); }
  function cancel()     { setEditing(null); }

  function save() {
    if (!title.trim()) return;
    if (editing === "new") {
      setNotes((prev) => [...prev, createNote(title, content)]);
    } else {
      setNotes((prev) => prev.map((n) => n.id === editing.id ? { ...n, title, content } : n));
    }
    setEditing(null);
  }

  function deleteNote(id) { setNotes((prev) => prev.filter((n) => n.id !== id)); }

  return (
    <div className="notes">
      <div className="notes-header">
        <h2>Notes</h2>
        <button className="btn btn-primary" onClick={startNew}>+ New</button>
      </div>

      {editing && (
        <div className="note-editor">
          <input className="note-title-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="note-content-input" placeholder="Write your note…" value={content} onChange={(e) => setContent(e.target.value)} rows={8} />
          <div className="editor-actions">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {notes.length === 0 && !editing
        ? <p className="empty">No notes yet — create one, or ask the AI to add notes for you!</p>
        : (
          <div className="notes-grid">
            {notes.map((note) => (
              <div key={note.id} className="note-card">
                <h3 className="note-card-title">{note.title}</h3>
                <p className="note-card-content">{note.content}</p>
                <div className="note-card-actions">
                  <button className="btn btn-ghost" onClick={() => startEdit(note)}>Edit</button>
                  <button className="btn btn-danger" onClick={() => deleteNote(note.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
