import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { getSourceContent, getSourceFileBlobUrl } from "./api.js";

// Opens the original source a citation came from, jumped/highlighted as
// close as possible to the cited spot:
//   pdf      -> browser's built-in PDF viewer, scrolled to the cited page
//   youtube  -> link to the video at the cited timestamp (opens in new tab)
//   url      -> link to the website (opens in new tab, no in-page anchor)
//   text/vtt -> full extracted text with the cited chunk highlighted
function SourceViewer({ notebookId, citation, onClose }) {
  const { getToken } = useAuth();
  const [content, setContent] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const highlightRef = useRef(null);
  const objectUrlRef = useRef(null);

  useEffect(() => {
    load();
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [citation.sourceId]);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [content]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getSourceContent(getToken, notebookId, citation.sourceId);
      setContent(data);

      if (data.source.sourceType === "pdf") {
        const url = await getSourceFileBlobUrl(getToken, notebookId, citation.sourceId);
        objectUrlRef.current = url;
        setPdfUrl(url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function renderBody() {
    if (loading) return <p className="empty">Loading source...</p>;
    if (error) return <p className="error">{error}</p>;
    if (!content) return null;

    const { source } = content;

    if (source.sourceType === "pdf" && pdfUrl) {
      const page = citation.pageNumber || 1;
      return (
        <iframe
          title="PDF source"
          src={`${pdfUrl}#page=${page}`}
          className="pdf-frame"
        />
      );
    }

    if (source.sourceType === "youtube") {
      const seconds = Math.floor(citation.startTimeSeconds || 0);
      const timestampedUrl = appendYoutubeTimestamp(source.url, seconds);
      return (
        <div className="link-viewer">
          <p>This citation comes from a YouTube video at approximately {formatTime(seconds)}.</p>
          <a href={timestampedUrl} target="_blank" rel="noopener noreferrer">
            Open video at {formatTime(seconds)} ↗
          </a>
        </div>
      );
    }

    if (source.sourceType === "url") {
      return (
        <div className="link-viewer">
          <p>This citation comes from a website. We don't control that page's rendering, so we can't jump to the exact spot — opening the source instead.</p>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            Open {source.url} ↗
          </a>
        </div>
      );
    }

    // text / vtt: highlight the cited character range in the full raw text
    const rawText = content.content?.rawText || "";
    const start = citation.startOffset ?? 0;
    const end = citation.endOffset ?? rawText.length;

    return (
      <div className="text-viewer">
        <span>{rawText.slice(0, start)}</span>
        <mark ref={highlightRef}>{rawText.slice(start, end)}</mark>
        <span>{rawText.slice(end)}</span>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal source-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{citation.sourceTitle || "Source"}</h3>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        {renderBody()}
      </div>
    </div>
  );
}

function appendYoutubeTimestamp(url, seconds) {
  try {
    const u = new URL(url);
    u.searchParams.set("t", `${seconds}s`);
    return u.toString();
  } catch {
    return url;
  }
}

function formatTime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default SourceViewer;
