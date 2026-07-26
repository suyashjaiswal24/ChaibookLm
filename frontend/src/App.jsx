import { useState } from "react";
import SourceCard from "./SourceCard.jsx";

const API_BASE = "http://localhost:3001/api/upload";

function App() {
  const [status, setStatus] = useState("");

  async function handleFileUpload(endpoint, file) {
    const formData = new FormData();
    formData.append("file", file);
    await sendRequest(endpoint, formData, false);
  }

  async function handleTextUpload(text) {
    await sendRequest("text", { text }, true);
  }

  async function handleUrlUpload(url) {
    await sendRequest("url", { url }, true);
  }

  async function handleYoutubeUpload(url) {
    await sendRequest("youtube", { url }, true);
  }

  async function sendRequest(endpoint, body, isJson) {
    setStatus("Uploading...");
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: isJson ? { "Content-Type": "application/json" } : undefined,
        body: isJson ? JSON.stringify(body) : body,
      });
      const data = await res.json();
      setStatus(data.message || "Done!");
    } catch (err) {
      setStatus("Something went wrong. Is the backend running?");
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>ChaibookLM</h1>
        <p>Add a source below. For now, it just gets logged on the backend.</p>
      </header>

      {status && <div className="status-banner">{status}</div>}

      <div className="grid">
        <SourceCard title="📄 PDF" description="Upload a PDF document.">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => e.target.files[0] && handleFileUpload("pdf", e.target.files[0])}
          />
        </SourceCard>

        <SourceCard title="📝 Plain Text" description="Paste text directly.">
          <TextForm onSubmit={handleTextUpload} />
        </SourceCard>

        <SourceCard title="🌐 Website URL" description="Paste a link to a webpage.">
          <UrlForm placeholder="https://example.com/article" onSubmit={handleUrlUpload} />
        </SourceCard>

        <SourceCard title="▶️ YouTube Video" description="Paste a YouTube video link.">
          <UrlForm placeholder="https://youtube.com/watch?v=..." onSubmit={handleYoutubeUpload} />
        </SourceCard>

        <SourceCard title="🎬 VTT / Transcript" description="Upload a .vtt or transcript file.">
          <input
            type="file"
            accept=".vtt,.srt,.txt"
            onChange={(e) => e.target.files[0] && handleFileUpload("vtt", e.target.files[0])}
          />
        </SourceCard>
      </div>
    </div>
  );
}

function TextForm({ onSubmit }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onSubmit(value);
          setValue("");
        }
      }}
    >
      <textarea
        rows={3}
        placeholder="Paste or type text here..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit">Add Text</button>
    </form>
  );
}

function UrlForm({ placeholder, onSubmit }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onSubmit(value);
          setValue("");
        }
      }}
    >
      <input
        type="url"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit">Add Link</button>
    </form>
  );
}

export default App;
