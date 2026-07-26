import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { NotebookText, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listNotebooks, createNotebook, deleteNotebook } from "./api.js";

function NotebooksScreen({ onOpenNotebook }) {
  const { getToken } = useAuth();
  const [notebooks, setNotebooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

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
              onClick={() => onOpenNotebook(nb)}
              className="group flex cursor-pointer flex-col gap-3 p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <NotebookText className="h-5 w-5 text-brand-600" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(nb.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <h3 className="truncate text-sm font-medium text-slate-900">{nb.title}</h3>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotebooksScreen;
