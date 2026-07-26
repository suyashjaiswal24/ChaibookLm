// ---------------------------------------------------------------------------
// queryTranslation.js
// STEP 1 of Query Phase: turn the user's raw query into several
// high-probability search variants. Each technique attacks retrieval from a
// different angle:
//
//   - rewritten:  fixes typos/grammar, makes the query explicit
//   - stepBack:   asks a broader, more general question (step-back prompting)
//   - subQueries: decomposes the query into 3 focused sub-questions
//   - hyde:       writes a hypothetical passage that WOULD answer the query
//                 (HyDE) -- embedding this often lands closer to real
//                 document vectors than embedding the bare question does
//
// All variants + the original query are later embedded and searched
// (see retriever.js), then fused together with Reciprocal Rank Fusion.
// ---------------------------------------------------------------------------
const { openai, CONFIG } = require("../config");

async function generateQueryVariants(rawQuery) {
  const prompt = `You are a search query optimizer for a document retrieval system.
Given the user's raw query, produce three things as JSON:

1. "rewritten": the same query with typos/grammar fixed and made explicit/unambiguous.
2. "stepBack": a broader, more general question that provides useful background context (step-back prompting).
3. "subQueries": an array of exactly 3 focused sub-questions that decompose the original query into smaller retrievable parts.

User query: "${rawQuery}"

Respond with ONLY valid JSON in this exact shape:
{"rewritten": "...", "stepBack": "...", "subQueries": ["...", "...", "..."]}`;

  const response = await openai.chat.completions.create({
    model: CONFIG.chatModel,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  return JSON.parse(response.choices[0].message.content);
}

async function generateHydePassage(rawQuery, extraKeywords = []) {
  const keywordHint =
    extraKeywords.length > 0
      ? `\nFocus especially on these aspects: ${extraKeywords.join(", ")}.`
      : "";

  const prompt = `Write a short, plausible passage (3-5 sentences) that would answer the following question, as if it were an excerpt taken directly from a relevant document. Do not mention that it's hypothetical. Just write the passage.${keywordHint}

Question: "${rawQuery}"`;

  const response = await openai.chat.completions.create({
    model: CONFIG.chatModel,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.5,
  });

  return response.choices[0].message.content.trim();
}

/**
 * Produce the full set of query variants for retrieval.
 * @param {string} rawQuery - original user query
 * @param {string[]} [extraKeywords] - optional keywords from the CRAG grader loop, used to steer HyDE on retries.
 */
async function translateQuery(rawQuery, extraKeywords = []) {
  const [variants, hyde] = await Promise.all([
    generateQueryVariants(rawQuery),
    generateHydePassage(rawQuery, extraKeywords),
  ]);

  return {
    original: rawQuery,
    rewritten: variants.rewritten,
    stepBack: variants.stepBack,
    subQueries: variants.subQueries,
    hyde,
  };
}

module.exports = { translateQuery };
