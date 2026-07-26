const { openai, CONFIG } = require("./config");

// Embed many texts in one batched OpenAI call.
async function embedBatch(texts) {
  const response = await openai.embeddings.create({
    model: CONFIG.embeddingModel,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

module.exports = { embedBatch };
