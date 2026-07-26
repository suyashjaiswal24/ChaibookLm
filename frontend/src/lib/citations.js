// Same source chunk can win RRF multiple times across CRAG attempts;
// keep one citation per unique (source, chunk). Chunks are then grouped by
// their exact match location (page number / video timestamp) rather than
// collapsed into one page range per source — a PDF cited on page 4 AND
// page 70 should show as two separate citations, not "p.4-70".
export function groupCitations(sources) {
  const seen = new Set();
  const deduped = sources.filter((s) => {
    const key = `${s.sourceId}-${s.chunkIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const byLocation = new Map();
  for (const citation of deduped) {
    const locationKey = `${citation.sourceId}::${citation.pageNumber ?? ""}::${citation.startTimeSeconds ?? ""}`;
    if (!byLocation.has(locationKey)) byLocation.set(locationKey, []);
    byLocation.get(locationKey).push(citation);
  }

  return [...byLocation.values()]
    .map((group) => {
      const offsetsStart = group.map((c) => c.startOffset).filter((o) => o != null);
      const offsetsEnd = group.map((c) => c.endOffset).filter((o) => o != null);

      return {
        ...group[0],
        label: buildLabel(group[0]),
        chunks: group,
        startOffset: offsetsStart.length > 0 ? Math.min(...offsetsStart) : null,
        endOffset: offsetsEnd.length > 0 ? Math.max(...offsetsEnd) : null,
      };
    })
    .sort((a, b) => {
      if (a.sourceId !== b.sourceId) return 0;
      if (a.pageNumber != null && b.pageNumber != null) return a.pageNumber - b.pageNumber;
      if (a.startTimeSeconds != null && b.startTimeSeconds != null) return a.startTimeSeconds - b.startTimeSeconds;
      return 0;
    });
}

function buildLabel(citation) {
  const title = citation.sourceTitle || citation.sourceType;

  if (citation.pageNumber != null) {
    return `${title} · p.${citation.pageNumber}`;
  }

  if (citation.startTimeSeconds != null) {
    return `${title} · ${formatTime(citation.startTimeSeconds)}`;
  }

  return title;
}

export function formatTime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
