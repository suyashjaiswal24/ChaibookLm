import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/react";
import AddSourceModal from "./AddSourceModal.jsx";
import ChatPanel from "./ChatPanel.jsx";
import SourceViewer from "./SourceViewer.jsx";
import { listSources, addSource, deleteSource, reindexSource } from "./api.js";

const POLL_INTERVAL_MS = 3000;
const ACTIVE_STATUSES = ["pending", "processing"];

function NotebookWorkspace({ notebook, onBack }) {
  const { getToken } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerCitation, setViewerCitation] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    refresh();
    return () => clearInterval(pollRef.current);
  }, [notebook.id]);

  useEffect(() => {
    clearInterval(pollRef.current);
    const hasActive = sources.some((s) => ACTIVE_STATUSES.includes(s.status));
    if (hasActive) {
      pollRef.current = setInterval(() => refresh({ silent: true }), POLL_INTERVAL_MS);
    }
    return () => clearInterval(pollRef.current);
  }, [sources]);

  async function refresh({ silent } = {}) {
    if (!silent) setLoading(true);
    try {
      setSources(await listSources(getToken, notebook.id));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function submitSource(type, body, isJson) {
    await addSource(getToken, notebook.id, type, body, isJson);
    setModalOpen(false);
    refresh();
  }

  async function handleDelete(sourceId) {
    await deleteSource(getToken, notebook.id, sourceId);
    refresh();
  }

  async function handleReindex(sourceId) {
    await reindexSource(getToken, notebook.id, sourceId);
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
                <span className={`status-badge status-${s.status}`}>{s.status}</span>
                <span className="time"> ({new Date(s.createdAt).toLocaleString()})</span>
                {s.status === "failed" && s.statusError && (
                  <div className="source-error">{s.statusError}</div>
                )}
                <div className="source-actions">
                  <button onClick={() => handleReindex(s.id)}>Re-index</button>
                  <button className="danger" onClick={() => handleDelete(s.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ChatPanel
        notebookId={notebook.id}
        hasReadySources={sources.some((s) => s.status === "ready")}
        onOpenCitation={setViewerCitation}
      />

      {modalOpen && (
        <AddSourceModal onClose={() => setModalOpen(false)} onSubmit={submitSource} />
      )}

      {viewerCitation && (
        <SourceViewer
          notebookId={notebook.id}
          citation={viewerCitation}
          onClose={() => setViewerCitation(null)}
        />
      )}
    </div>
  );
}

export default NotebookWorkspace;
