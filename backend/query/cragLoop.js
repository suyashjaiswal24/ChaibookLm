// ---------------------------------------------------------------------------
// cragLoop.js
// Orchestrates the ENTIRE Query Phase, in order, scoped to one notebook:
//
//   1. translateQuery()      -> build query variants (rewritten, stepBack,
//                                subQueries, HyDE) from the raw user query
//   2. retrieveWithFusion()  -> embed + search each variant within the given
//                                notebook, fuse with RRF, get top documents
//   3. generateAnswer()      -> LLM answers the ORIGINAL query using those
//                                top documents
//   4. gradeAnswer()         -> mini model scores the answer 1-10
//
//   CRAG (Corrective RAG) loop:
//   If score > threshold -> done, return the answer.
//   If score <= threshold -> take the grader's improvementKeywords, use them
//   to steer a NEW HyDE passage + retrieval round, regenerate the answer,
//   and grade again. Repeat up to CONFIG.maxCragRetries times, then return
//   the best answer found even if it never crossed the threshold.
// ---------------------------------------------------------------------------
const { CONFIG } = require("../config");
const { translateQuery } = require("./queryTranslation");
const { retrieveWithFusion } = require("./retriever");
const { generateAnswer } = require("./generator");
const { gradeAnswer } = require("./grader");

/**
 * Run the full CRAG query pipeline for one user question within one notebook.
 * @param {string} rawQuery - the user's original question
 * @param {string} notebookId - restricts retrieval to this notebook's chunks
 * @param {Array<{role: "user"|"assistant", content: string}>} [history] - prior turns in this notebook's conversation
 * @returns {Promise<{answer: string, score: number, attempts: number, sources: Array}>}
 */
async function answerQuery(rawQuery, notebookId, history = []) {
  let bestAnswer = null;
  let bestScore = -1;
  let bestDocs = [];
  let improvementKeywords = [];

  for (let attempt = 1; attempt <= CONFIG.maxCragRetries; attempt++) {
    const variants = await translateQuery(rawQuery, improvementKeywords);
    const topDocs = await retrieveWithFusion(variants, notebookId);

    if (topDocs.length === 0) {
      return { answer: "No sources have been added to this notebook yet, or nothing relevant was found.", score: 0, attempts: attempt, sources: [] };
    }

    const answer = await generateAnswer(rawQuery, topDocs, history);
    const { score, improvementKeywords: newKeywords } = await gradeAnswer(rawQuery, answer);

    if (score > bestScore) {
      bestAnswer = answer;
      bestScore = score;
      bestDocs = topDocs;
    }

    if (score > CONFIG.scoreThreshold) {
      return { answer, score, attempts: attempt, sources: summarizeSources(topDocs) };
    }

    improvementKeywords = newKeywords;
  }

  return {
    answer: bestAnswer,
    score: bestScore,
    attempts: CONFIG.maxCragRetries,
    sources: summarizeSources(bestDocs),
  };
}

function summarizeSources(docs) {
  return docs.map((d) => ({ sourceId: d.sourceId, chunkIndex: d.chunkIndex }));
}

module.exports = { answerQuery };
