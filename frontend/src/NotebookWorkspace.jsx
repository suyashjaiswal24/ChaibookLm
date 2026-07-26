import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/react";
import { ArrowLeft, Plus, RotateCw, Trash2, XCircle } from "lucide-react";
import AddSourceModal from "./AddSourceModal.jsx";
import ChatPanel from "./ChatPanel.jsx";
import CitationsPanel from "./CitationsPanel.jsx";
import SourceViewer from "./SourceViewer.jsx";
import StatusDot from "./components/StatusDot.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import { Button } from "@/components/ui/button";
import { statusMeta, ACTIVE_STATUSES } from "@/lib/sourceStatus";
import { listSources, addSource, deleteSource, deleteAllSources, reindexSource } from "./api.js";

const POLL_INTERVAL_MS = 3000;

function NotebookWorkspace({ notebook, onBack }) {
  const { getToken } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerCitation, setViewerCitation] = useState(null);
  const [latestCitations, setLatestCitations] = useState([]);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
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

  async function handleRemoveAll() {
    await deleteAllSources(getToken, notebook.id);
    refresh();
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1 self-start text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Notebooks
        </button>
        <h2 className="mb-3 truncate text-sm font-semibold text-slate-900">{notebook.title}</h2>
        <Button onClick={() => setModalOpen(true)} className="w-full">
          <Plus className="h-4 w-4" /> Add Source
        </Button>

        {sources.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => setConfirmRemoveAll(true)}
            className="mt-2 w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <XCircle className="h-4 w-4" /> Remove all sources
          </Button>
        )}

        {loading ? (
          <p className="mt-4 text-xs text-slate-400">Loading...</p>
        ) : sources.length === 0 ? (
          <p className="mt-4 text-xs text-slate-400">No sources yet.</p>
        ) : (
          <ul className="mt-4 flex-1 space-y-0.5 overflow-y-auto">
            {sources.map((s) => {
              const meta = statusMeta(s.status);
              return (
                <li
                  key={s.id}
                  className="group flex items-center gap-2 rounded-md px-1.5 py-2 hover:bg-slate-50"
                >
                  <StatusDot status={s.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700">{s.title}</p>
                    {s.status === "failed" && s.statusError ? (
                      <p className="truncate text-xs text-red-600">{s.statusError}</p>
                    ) : (
                      <p className="text-xs text-slate-400">{meta.label}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" title="Re-index" onClick={() => handleReindex(s.id)}>
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleDelete(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <ChatPanel
        notebookId={notebook.id}
        hasReadySources={sources.some((s) => s.status === "ready")}
        onLatestCitations={setLatestCitations}
      />

      {latestCitations.length > 0 && (
        <CitationsPanel citations={latestCitations} onOpenCitation={setViewerCitation} />
      )}

      {viewerCitation && (
        <SourceViewer
          notebookId={notebook.id}
          citation={viewerCitation}
          onClose={() => setViewerCitation(null)}
        />
      )}

      {modalOpen && (
        <AddSourceModal onClose={() => setModalOpen(false)} onSubmit={submitSource} />
      )}

      {confirmRemoveAll && (
        <ConfirmDialog
          title="Remove all sources?"
          description={`This will permanently delete all ${sources.length} source(s) in this notebook, including their chunks and embeddings. This can't be undone.`}
          confirmLabel="Remove all"
          onConfirm={handleRemoveAll}
          onClose={() => setConfirmRemoveAll(false)}
        />
      )}
    </div>
  );
}

export default NotebookWorkspace;
