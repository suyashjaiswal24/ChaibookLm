const { Queue } = require("bullmq");
const { CONFIG } = require("../config");

const connection = { url: CONFIG.redisUrl };

const sourceQueue = new Queue("process-source", { connection });

// Enqueues a source for background processing (extract -> chunk -> embed).
function enqueueSourceProcessing(sourceId) {
  return sourceQueue.add("process-source", { sourceId });
}

module.exports = { sourceQueue, enqueueSourceProcessing, connection };
