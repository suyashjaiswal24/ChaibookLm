import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime } from "@/lib/citations";
import { getSourceContent, getSourceFileBlobUrl } from "./api.js";

// Opens the original source a citation came from, jumped/highlighted as
// close as possible to the cited spot:
//   pdf      -> browser's built-in PDF viewer, scrolled to the cited page
//   youtube  -> embedded video player, starting at the cited timestamp
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
    if (loading) return <p className="p-8 text-center text-sm text-slate-400">Loading source...</p>;
    if (error) return <p className="p-8 text-center text-sm text-red-600">{error}</p>;
    if (!content) return null;

    const { source } = content;

    if (source.sourceType === "pdf" && pdfUrl) {
      const page = citation.pageNumber || 1;
      return (
        <iframe title="PDF source" src={`${pdfUrl}#page=${page}`} className="h-[70vh] w-full border-none" />
      );
    }

    if (source.sourceType === "youtube") {
      const seconds = Math.floor(citation.startTimeSeconds || 0);
      const embedUrl = toYoutubeEmbedUrl(source.url, seconds);
      return (
        <div className="p-4">
          {embedUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg">
              <iframe
                title="YouTube source"
                src={embedUrl}
                className="h-full w-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Couldn't load this video.</p>
          )}
          <p className="mt-3 text-xs text-slate-500">Cited at approximately {formatTime(seconds)}.</p>
        </div>
      );
    }

    if (source.sourceType === "url") {
      return (
        <div className="p-8">
          <p className="mb-3 text-sm text-slate-600">
            This citation comes from a website. We don't control that page's rendering, so we can't jump
            to the exact spot — open the source instead.
          </p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
          >
            Open {source.url} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      );
    }

    // text / vtt: highlight the cited character range in the full raw text
    const rawText = content.content?.rawText || "";
    const start = citation.startOffset ?? 0;
    const end = citation.endOffset ?? rawText.length;

    return (
      <div className="max-h-[70vh] overflow-y-auto p-6 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
        <span>{rawText.slice(0, start)}</span>
        <mark ref={highlightRef} className="rounded bg-amber-200 px-0.5">
          {rawText.slice(start, end)}
        </mark>
        <span>{rawText.slice(end)}</span>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader>
          <DialogTitle>{citation.sourceTitle || "Source"}</DialogTitle>
        </DialogHeader>
        {renderBody()}
      </DialogContent>
    </Dialog>
  );
}

function toYoutubeEmbedUrl(url, startSeconds) {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (!videoId && u.hostname.includes("youtu.be")) {
      videoId = u.pathname.slice(1);
    }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?start=${startSeconds}&autoplay=0`;
  } catch {
    return null;
  }
}

export default SourceViewer;
