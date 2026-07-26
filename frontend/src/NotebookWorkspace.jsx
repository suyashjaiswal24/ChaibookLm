import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import AddSourceModal from "./AddSourceModal.jsx";
import { listSources, addSource } from "./api.js";

function NotebookWorkspace({ notebook, onBack }) {
  const { getToken } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh();
  }, [notebook.id]);

  async function refresh() {
    setLoading(true);
    try {
      setSources(await listSources(getToken, notebook.id));
    } finally {
      setLoading(false);
    }
  }

  async function submitSource(type, body, isJson) {
    await addSource(getToken, notebook.id, type, body, isJson);
    setModalOpen(false);
    refresh();
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <button className="back-btn" onClick={onBack}>
          ← All Notebooks
        </button>
        <h2>{notebook.title}</h2>
        <button className="add-btn" onClick={() => setModalOpen(true)}>
          + Add Source
        </button>
      </aside>

      <main className="content">
        <h1>Sources</h1>
        {loading ? (
          <p>Loading...</p>
        ) : sources.length === 0 ? (
          <p className="empty">No sources added yet.</p>
        ) : (
          <ul className="source-list">
            {sources.map((s) => (
              <li key={s.id}>
                <strong>{s.sourceType}</strong> — {s.title}
                <span className="time"> ({new Date(s.createdAt).toLocaleString()})</span>
              </li>
            ))}
          </ul>
        )}
      </main>

      {modalOpen && (
        <AddSourceModal onClose={() => setModalOpen(false)} onSubmit={submitSource} />
      )}
    </div>
  );
}

export default NotebookWorkspace;
