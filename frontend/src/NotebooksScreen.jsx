import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
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
    <div className="notebooks-screen">
      <h1>Your Notebooks</h1>

      <form className="new-notebook-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New notebook title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : notebooks.length === 0 ? (
        <p className="empty">No notebooks yet. Create one above.</p>
      ) : (
        <div className="notebook-grid">
          {notebooks.map((nb) => (
            <div key={nb.id} className="notebook-card" onClick={() => onOpenNotebook(nb)}>
              <h3>{nb.title}</h3>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(nb.id);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotebooksScreen;
