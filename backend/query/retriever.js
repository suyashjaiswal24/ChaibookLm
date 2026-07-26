// ---------------------------------------------------------------------------
// retriever.js
// STEP 2 of Query Phase: take all query variants from queryTranslation.js,
// embed each one, search Qdrant (scoped to one notebook) for each, then fuse
// the separate ranked lists into one final ranked list using Reciprocal
// Rank Fusion (RRF).
//
// Why RRF? Each query variant returns its own ranking of chunks. A chunk
// that appears near the top across MULTIPLE variants is more likely to be
// truly relevant than a chunk that only one variant happened to surface.
//
// Why per-source top-N before the final merge? A notebook with one huge,
// highly-relevant source (e.g. a full textbook PDF) can otherwise flood the
// global top-K with its own chunks, crowding out a smaller but genuinely
// relevant source (e.g. a short transcript) entirely. Capping how many
// chunks each source can contribute before the final cross-source merge
// guarantees every source with a real match gets a fair shot at being cited.
// ---------------------------------------------------------------------------
const { qdrant, CONFIG } = require("../config");
const { embedBatch } = require("../embeddings");
const { withRetry } = require("../pipeline/withRetry");

const RRF_K = 60; // standard smoothing constant used in RRF formula

// Search Qdrant for the closest chunks to one embedding vector, restricted
// to a single notebook (Phase 11: "only that notebook's chunks are searched").
async function searchByVector(vector, notebookId) {
  const results = await withRetry(() =>
    qdrant.search(CONFIG.qdrantCollection, {
      vector,
      limit: CONFIG.topKPerQueryVariant,
      with_payload: true,
      filter: {
        must: [{ key: "notebook_id", match: { value: notebookId } }],
      },
    })
  );

  return results.map((r) => ({
    id: r.id,
    text: r.payload.text,
    sourceId: r.payload.source_id,
    chunkId: r.payload.chunk_id,
    chunkIndex: r.payload.chunk_index,
    pageNumber: r.payload.page_number,
    startTimeSeconds: r.payload.start_time_seconds,
    startOffset: r.payload.start_offset,
    endOffset: r.payload.end_offset,
    score: r.score,
  }));
}

// Combine several ranked lists of documents into one using RRF:
// score(doc) = sum over lists of 1 / (k + rank).
function reciprocalRankFusion(rankedLists) {
  const fused = new Map(); // id -> { ...doc, rrfScore }

  for (const list of rankedLists) {
    list.forEach((doc, rank) => {
      const contribution = 1 / (RRF_K + rank + 1);
      const existing = fused.get(doc.id);
      if (existing) {
        existing.rrfScore += contribution;
      } else {
        fused.set(doc.id, { ...doc, rrfScore: contribution });
      }
    });
  }

  return [...fused.values()].sort((a, b) => b.rrfScore - a.rrfScore);
}

// Caps how many chunks a single source can contribute before the final
// cross-source merge, so one dominant source can't crowd out the rest.
function capPerSource(rankedDocs, maxPerSource) {
  const countBySource = new Map();
  const capped = [];

  for (const doc of rankedDocs) {
    const count = countBySource.get(doc.sourceId) || 0;
    if (count >= maxPerSource) continue;
    countBySource.set(doc.sourceId, count + 1);
    capped.push(doc);
  }

  return capped;
}

/**
 * Given all query variants, search the vector DB (scoped to one notebook)
 * with each and fuse the results.
 * @param {{original, rewritten, stepBack, subQueries, hyde}} variants
 * @param {string} notebookId
 */
async function retrieveWithFusion(variants, notebookId) {
  const searchTexts = [
    variants.original,
    variants.rewritten,
    variants.stepBack,
    ...variants.subQueries,
    variants.hyde,
  ];

  const vectors = await embedBatch(searchTexts);
  const rankedLists = await Promise.all(vectors.map((v) => searchByVector(v, notebookId)));

  const fused = reciprocalRankFusion(rankedLists);
  const capped = capPerSource(fused, CONFIG.maxChunksPerSource);
  return capped.slice(0, CONFIG.finalTopK);
}

module.exports = { retrieveWithFusion };
