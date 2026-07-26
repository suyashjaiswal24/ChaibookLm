import { useState } from "react";
import { FileText, Type, Globe, Video, Captions, ArrowLeft, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const SOURCE_TYPES = [
  { key: "pdf", label: "PDF", icon: FileText },
  { key: "text", label: "Plain Text", icon: Type },
  { key: "url", label: "Website URL", icon: Globe },
  { key: "youtube", label: "YouTube Video", icon: Video },
  { key: "vtt", label: "VTT / Transcript", icon: Captions },
];

function AddSourceModal({ onClose, onSubmit }) {
  const [selected, setSelected] = useState(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
        </DialogHeader>

        <div className="p-5">
          {!selected ? (
            <div className="grid grid-cols-2 gap-3">
              {SOURCE_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSelected(t.key)}
                  className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-sm font-medium text-slate-700 transition-colors hover:border-brand-500 hover:bg-brand-50"
                >
                  <t.icon className="h-5 w-5 text-brand-600" />
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <SourceForm type={selected} onBack={() => setSelected(null)} onSubmit={onSubmit} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SourceForm({ type, onBack, onSubmit }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (type === "pdf" || type === "vtt") {
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        setSubmitting(true);
        await onSubmit(type, formData, false);
      } else if (type === "text") {
        if (!text.trim()) return;
        setSubmitting(true);
        await onSubmit("text", { text }, true);
      } else if (type === "url" || type === "youtube") {
        if (!url.trim()) return;
        setSubmitting(true);
        await onSubmit(type, { url }, true);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="flex items-center gap-1 self-start text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {(type === "pdf" || type === "vtt") && (
        <Input
          type="file"
          accept={type === "pdf" ? "application/pdf" : ".vtt,.srt,.txt"}
          onChange={(e) => setFile(e.target.files[0])}
          disabled={submitting}
          className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-700"
        />
      )}

      {type === "text" && (
        <Textarea
          rows={5}
          placeholder="Paste or type text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitting}
        />
      )}

      {(type === "url" || type === "youtube") && (
        <Input
          type="url"
          placeholder={type === "youtube" ? "https://youtube.com/watch?v=..." : "https://example.com/article"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={submitting}
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
          </>
        ) : (
          "Add Source"
        )}
      </Button>
    </form>
  );
}

export default AddSourceModal;
