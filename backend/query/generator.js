// ---------------------------------------------------------------------------
// generator.js
// STEP 3 of Query Phase: given the top documents (after RRF) and the
// ORIGINAL user query, ask the main LLM to produce the final answer.
// ---------------------------------------------------------------------------
const { openai, CONFIG } = require("../config");

/**
 * Generate an answer grounded in the given documents.
 * @param {string} originalQuery
 * @param {Array<{text: string}>} documents
 * @returns {Promise<string>}
 */
async function generateAnswer(originalQuery, documents) {
  const context = documents
    .map((doc, i) => `[Document ${i + 1}]\n${doc.text}`)
    .join("\n\n");

  const prompt = `Answer the user's question using ONLY the context documents below. If the documents don't contain enough information, say so honestly instead of guessing.

Context:
${context}

Question: ${originalQuery}

Answer:`;

  const response = await openai.chat.completions.create({
    model: CONFIG.chatModel,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}

module.exports = { generateAnswer };
