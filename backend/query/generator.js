// ---------------------------------------------------------------------------
// generator.js
// STEP 3 of Query Phase: given the top documents (after RRF) and the
// ORIGINAL user query, ask the main LLM to produce the final answer.
// ---------------------------------------------------------------------------
const { openai, CONFIG } = require("../config");

/**
 * Generate an answer grounded in the given documents, aware of prior
 * conversation turns so follow-up questions resolve correctly.
 * @param {string} originalQuery
 * @param {Array<{text: string}>} documents
 * @param {Array<{role: "user"|"assistant", content: string}>} [history]
 * @returns {Promise<string>}
 */
async function generateAnswer(originalQuery, documents, history = []) {
  const context = documents
    .map((doc, i) => `[Document ${i + 1}]\n${doc.text}`)
    .join("\n\n");

  const systemPrompt = `Answer the user's question using ONLY the context documents below. If the documents don't contain enough information, say so honestly instead of guessing. Use the prior conversation only to understand what the user is referring to (e.g. follow-ups like "what about X instead"), not as a source of facts.

Context:
${context}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: originalQuery },
  ];

  const response = await openai.chat.completions.create({
    model: CONFIG.chatModel,
    messages,
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}

module.exports = { generateAnswer };
