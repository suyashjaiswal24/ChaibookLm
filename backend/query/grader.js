// ---------------------------------------------------------------------------
// grader.js
// STEP 4 of Query Phase (CRAG): use a cheap "mini" model to grade the
// generated answer on a 1-10 scale. If the score is low, also ask it for
// keywords that would help retrieve BETTER documents next loop iteration.
// ---------------------------------------------------------------------------
const { openai, CONFIG } = require("../config");

/**
 * @param {string} originalQuery
 * @param {string} answer
 * @returns {Promise<{score: number, improvementKeywords: string[]}>}
 */
async function gradeAnswer(originalQuery, answer) {
  const prompt = `You are grading how well an AI-generated answer addresses a user's question.

Question: "${originalQuery}"

Answer: "${answer}"

Rate the answer's quality and completeness on a scale of 1 to 10 (10 = fully and accurately answers the question).
If the score is below 6, also list 3-5 short keywords/phrases that describe what information is MISSING and should be searched for to improve the answer. If the score is 6 or above, return an empty array for keywords.

Respond with ONLY valid JSON in this exact shape:
{"score": <number 1-10>, "improvementKeywords": ["...", "..."]}`;

  const response = await openai.chat.completions.create({
    model: CONFIG.graderModel,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return {
    score: parsed.score,
    improvementKeywords: parsed.improvementKeywords || [],
  };
}

module.exports = { gradeAnswer };
