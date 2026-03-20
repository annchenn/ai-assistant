import { useState } from "react";
import { validateApiKey } from "../lib/gemini";
import { saveApiKey } from "../lib/storage";
import "./ApiKeySetup.css";

export default function ApiKeySetup({ onDone }) {
  const [key,     setKey]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [show,    setShow]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await validateApiKey(trimmed);
      saveApiKey(trimmed);
      onDone(trimmed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <div className="setup-icon">✦</div>
        <h1 className="setup-title">My AI Assistant</h1>
        <p className="setup-subtitle">
          Enter your Gemini API key to get started.<br />
          Your key is stored locally and never sent anywhere except Google.
        </p>

        <form className="setup-form" onSubmit={handleSubmit}>
          <div className="key-input-wrap">
            <input
              className="key-input"
              type={show ? "text" : "password"}
              placeholder="AIzaSy..."
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(null); }}
              autoFocus
              spellCheck={false}
            />
            <button
              type="button"
              className="show-toggle"
              onClick={() => setShow((s) => !s)}
              tabIndex={-1}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>

          {error && <p className="setup-error">⚠️ {error}</p>}

          <button
            className="setup-btn"
            type="submit"
            disabled={loading || !key.trim()}
          >
            {loading ? "Verifying…" : "Continue →"}
          </button>
        </form>

        <a
          className="setup-link"
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
        >
          Get a free API key from Google AI Studio ↗
        </a>
      </div>
    </div>
  );
}
