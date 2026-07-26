// Plain text sources already have their content stored directly on the row.
// A single segment spanning the whole text lets the indexer compute
// character offsets for each chunk uniformly with other source types.
async function extractText(source) {
  const fullText = source.content || "";
  return {
    fullText,
    segments: fullText ? [{ start: 0, end: fullText.length }] : [],
  };
}

module.exports = { extractText };
