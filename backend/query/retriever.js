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
// ---------------------------------------------------------------------------
const { qdrant, CONFIG } = require("../config");
const { embedBatch } = require("../embeddings");

const RRF_K = 60; // standard smoothing constant used in RRF formula

// Search Qdrant for the closest chunks to one embedding vector, restricted
// to a single notebook (Phase 11: "only that notebook's chunks are searched").
async function searchByVector(vector, notebookId) {
  const results = await qdrant.search(CONFIG.qdrantCollection, {
    vector,
    limit: CONFIG.topKPerQueryVariant,
    with_payload: true,
    filter: {
      must: [{ key: "notebook_id", match: { value: notebookId } }],
    },
  });

  return results.map((r) => ({
    id: r.id,
    text: r.payload.text,
    sourceId: r.payload.source_id,
    chunkIndex: r.payload.chunk_index,
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
  return fused.slice(0, CONFIG.finalTopK);
}

module.exports = { retrieveWithFusion };
