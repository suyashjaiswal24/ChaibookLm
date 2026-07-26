import { BookText } from "lucide-react";

// Right-hand column showing citations for the most recent assistant answer.
// Only rendered by the parent once citations exist for the latest turn.
function CitationsPanel({ citations, onOpenCitation }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Sources for this answer
      </h3>
      <ul className="space-y-2 overflow-y-auto">
        {citations.map((c) => (
          <li key={`${c.sourceId}-${c.chunkIndex}`}>
            <button
              onClick={() => onOpenCitation(c)}
              title={c.text}
              className="flex w-full items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
            >
              <BookText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="text-xs font-medium text-slate-700">{c.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default CitationsPanel;
