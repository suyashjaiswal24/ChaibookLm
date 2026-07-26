const { openai, CONFIG } = require("./config");

// OpenAI's embeddings endpoint caps a single request at 300k input tokens
// AND at 2048 array items. Stay well under the token limit since our
// estimate is approximate, and respect the hard item-count limit exactly.
const MAX_TOKENS_PER_REQUEST = 250_000;
const MAX_ITEMS_PER_REQUEST = 2048;

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Splits texts into sub-batches that each stay under both the per-request
// token limit and the 2048-item limit, so large sources (long PDFs, long
// transcripts) don't get rejected.
function splitIntoBatches(texts) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;

  for (const text of texts) {
    const tokens = estimateTokens(text);
    const wouldExceedTokens = currentBatch.length > 0 && currentTokens + tokens > MAX_TOKENS_PER_REQUEST;
    const wouldExceedItems = currentBatch.length >= MAX_ITEMS_PER_REQUEST;

    if (wouldExceedTokens || wouldExceedItems) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }
    currentBatch.push(text);
    currentTokens += tokens;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  return batches;
}

// Embed many texts, automatically split across multiple OpenAI requests
// if needed to stay under the per-request token limit.
async function embedBatch(texts) {
  const batches = splitIntoBatches(texts);
  const allEmbeddings = [];

  for (const batch of batches) {
    const response = await openai.embeddings.create({
      model: CONFIG.embeddingModel,
      input: batch,
    });
    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

module.exports = { embedBatch };
