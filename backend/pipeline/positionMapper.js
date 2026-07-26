// Given a chunk's character range in fullText and the source's positional
// segments (from the extractor), finds which segment the chunk starts in
// and returns whatever positional fields that segment carries
// (pageNumber for PDFs, startTimeSeconds for YouTube/VTT).
function mapChunkToPosition(chunkStart, segments) {
  if (chunkStart == null || !segments || segments.length === 0) {
    return { pageNumber: null, startTimeSeconds: null };
  }

  const segment =
    segments.find((s) => chunkStart >= s.start && chunkStart < s.end) ||
    segments[segments.length - 1];

  return {
    pageNumber: segment.pageNumber ?? null,
    startTimeSeconds: segment.startTimeSeconds ?? null,
  };
}

module.exports = { mapChunkToPosition };
