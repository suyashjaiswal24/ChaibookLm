require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const OpenAI = require("openai");
const { QdrantClient } = require("@qdrant/js-client-rest");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL });

const CONFIG = {
  chatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  graderModel: process.env.OPENAI_GRADER_MODEL || "gpt-4o-mini",
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingDims: 1536,
  qdrantCollection: process.env.QDRANT_COLLECTION || "chaibooklm_chunks",
  chunkSize: 500,
  chunkOverlap: 50,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  // Query phase (CRAG)
  topKPerQueryVariant: 5,
  finalTopK: 6,
  maxChunksPerSource: 3,
  maxCragRetries: 3,
  scoreThreshold: 6,
};

module.exports = { openai, qdrant, CONFIG };
