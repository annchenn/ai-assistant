import { useState, useEffect } from "react";
import { getMemories, deleteMemory, clearMemories } from "../lib/api";
import "./Memory.css";

export default function Memory() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMemories().then(m => { setMemories(m); setLoading(false); });
  }, []);

  async function handleDelete(id) {
    await deleteMemory(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  }

  async function handleClear() {
    await clearMemories();
    setMemories([]);
  }

  return (
    <div className="memory-tab">
      <div className="memory-header">
        <h2>Long-term Memory</h2>
        {memories.length > 0 && (
          <button className="btn btn-ghost" onClick={handleClear}>Clear all</button>
        )}
      </div>
      {loading ? (
        <p className="memory-empty">Loading…</p>
      ) : memories.length === 0 ? (
        <p className="memory-empty">No memories yet. Chat with the AI and it will learn about you automatically.</p>
      ) : (
        <div className="memory-list">
          {memories.map(m => (
            <div key={m.id} className="memory-card">
              <span className="memory-fact">{m.fact}</span>
              <button className="memory-del" onClick={() => handleDelete(m.id)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
