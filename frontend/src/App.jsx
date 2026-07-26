import { useState } from "react";
import AddSourceModal from "./AddSourceModal.jsx";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";

const API_BASE = "http://localhost:3002/api/upload";

function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [sources, setSources] = useState([]);

  async function submitSource(endpoint, body, isJson, label) {
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: isJson ? { "Content-Type": "application/json" } : undefined,
        body: isJson ? JSON.stringify(body) : body,
      });
      const data = await res.json();
      setSources((prev) => [
        { label, message: data.message, time: new Date().toLocaleTimeString() },
        ...prev,
      ]);
      setModalOpen(false);
    } catch (err) {
      setSources((prev) => [
        {
          label,
          message: "Failed - is the backend running?",
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    }
  }

  return (
    <>
      <Show when="signed-out">
        <div className="auth-screen">
          <h1>ChaibookLM</h1>
          <p>Sign in to continue</p>
          <div className="auth-buttons">
            <SignInButton />
            <SignUpButton />
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        <header className="topbar">
          <UserButton />
        </header>
        <div className="layout">
          <aside className="sidebar">
            <h2>Sources</h2>
            <button className="add-btn" onClick={() => setModalOpen(true)}>
              + Add Source
            </button>
          </aside>

          <main className="content">
            <h1>ChaibookLM</h1>
            {sources.length === 0 ? (
              <p className="empty">No sources added yet.</p>
            ) : (
              <ul className="source-list">
                {sources.map((s, i) => (
                  <li key={i}>
                    <strong>{s.label}</strong> — {s.message}
                    <span className="time"> ({s.time})</span>
                  </li>
                ))}
              </ul>
            )}
          </main>

          {modalOpen && (
            <AddSourceModal
              onClose={() => setModalOpen(false)}
              onSubmit={submitSource}
            />
          )}
        </div>
      </Show>
    </>
  );
}

export default App;
