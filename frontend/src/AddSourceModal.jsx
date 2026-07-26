import { useState } from "react";

const SOURCE_TYPES = [
  { key: "pdf", label: "📄 PDF" },
  { key: "text", label: "📝 Plain Text" },
  { key: "url", label: "🌐 Website URL" },
  { key: "youtube", label: "▶️ YouTube Video" },
  { key: "vtt", label: "🎬 VTT / Transcript" },
];

function AddSourceModal({ onClose, onSubmit }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add a source</h3>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {!selected ? (
          <div className="type-grid">
            {SOURCE_TYPES.map((t) => (
              <button key={t.key} className="type-btn" onClick={() => setSelected(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <SourceForm type={selected} onBack={() => setSelected(null)} onSubmit={onSubmit} />
        )}
      </div>
    </div>
  );
}

function SourceForm({ type, onBack, onSubmit }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (type === "pdf" || type === "vtt") {
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      onSubmit(type, formData, false, labelFor(type));
    } else if (type === "text") {
      if (!text.trim()) return;
      onSubmit("text", { text }, true, labelFor(type));
    } else if (type === "url" || type === "youtube") {
      if (!url.trim()) return;
      onSubmit(type, { url }, true, labelFor(type));
    }
  }

  return (
    <form className="source-form" onSubmit={handleSubmit}>
      <button type="button" className="back-btn" onClick={onBack}>
        ← Back
      </button>

      {(type === "pdf" || type === "vtt") && (
        <input
          type="file"
          accept={type === "pdf" ? "application/pdf" : ".vtt,.srt,.txt"}
          onChange={(e) => setFile(e.target.files[0])}
        />
      )}

      {type === "text" && (
        <textarea
          rows={5}
          placeholder="Paste or type text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}

      {(type === "url" || type === "youtube") && (
        <input
          type="url"
          placeholder={type === "youtube" ? "https://youtube.com/watch?v=..." : "https://example.com/article"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      )}

      <button type="submit" className="submit-btn">
        Add Source
      </button>
    </form>
  );
}

function labelFor(type) {
  return SOURCE_TYPES.find((t) => t.key === type)?.label ?? type;
}

export default AddSourceModal;
