// Maps each backend pipeline stage to a short label and dot color for the UI.
// Wireframe requirement: yellow dot while indexing (any non-terminal stage),
// green dot once ready for querying, red on failure.
export const STATUS_META = {
  uploading: { label: "Uploading", dotClass: "bg-amber-500", pulse: true },
  extracting: { label: "Extracting", dotClass: "bg-amber-500", pulse: true },
  chunking: { label: "Chunking", dotClass: "bg-amber-500", pulse: true },
  embedding: { label: "Embedding", dotClass: "bg-amber-500", pulse: true },
  ready: { label: "Ready", dotClass: "bg-emerald-500", pulse: false },
  failed: { label: "Failed", dotClass: "bg-red-500", pulse: false },
};

export const ACTIVE_STATUSES = ["uploading", "extracting", "chunking", "embedding"];

export function statusMeta(status) {
  return STATUS_META[status] || { label: status, dotClass: "bg-slate-400", pulse: false };
}
