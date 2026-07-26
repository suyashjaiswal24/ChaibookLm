import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { NotebookText, Plus, Trash2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listNotebooks, createNotebook, deleteNotebook, renameNotebook } from "./api.js";

function NotebooksScreen({ onOpenNotebook }) {
  const { getToken } = useAuth();
  const [notebooks, setNotebooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setNotebooks(await listNotebooks(getToken));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createNotebook(getToken, title);
      setTitle("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    await deleteNotebook(getToken, id);
    refresh();
  }

  function startRename(notebook) {
    setEditingId(notebook.id);
    setEditingTitle(notebook.title);
  }

  async function commitRename(id) {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    try {
      await renameNotebook(getToken, id, trimmed);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Your Notebooks</h1>

      <form onSubmit={handleCreate} className="mb-8 flex gap-2">
        <Input
          type="text"
          placeholder="New notebook title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : notebooks.length === 0 ? (
        <p className="text-sm text-slate-400">No notebooks yet. Create one above.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {notebooks.map((nb) => (
            <Card
              key={nb.id}
              onClick={() => editingId !== nb.id && onOpenNotebook(nb)}
              className="group flex cursor-pointer flex-col gap-3 p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <NotebookText className="h-5 w-5 text-brand-600" />
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(nb);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-red-50 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(nb.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {editingId === nb.id ? (
                <Input
                  autoFocus
                  value={editingTitle}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => commitRename(nb.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(nb.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="text-sm"
                />
              ) : (
                <h3 className="truncate text-sm font-medium text-slate-900">{nb.title}</h3>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotebooksScreen;
