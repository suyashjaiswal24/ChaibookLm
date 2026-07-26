const { Worker } = require("bullmq");
const { eq } = require("drizzle-orm");
const { connection } = require("../queues/sourceQueue");
const { db, schema } = require("../db");
const { indexSource } = require("../pipeline/indexer");

const worker = new Worker(
  "process-source",
  async (job) => {
    const { sourceId } = job.data;
    console.log(`[worker] Processing source ${sourceId}...`);
    const result = await indexSource(sourceId);
    console.log(`[worker] Source ${sourceId} ready (${result.chunksIndexed} chunks).`);
    return result;
  },
  { connection }
);

worker.on("failed", async (job, err) => {
  console.error(`[worker] Source ${job.data.sourceId} failed:`, err.message);
  await db
    .update(schema.sources)
    .set({ status: "failed", statusError: err.message })
    .where(eq(schema.sources.id, job.data.sourceId));
});

console.log("ChaibookLM source-processing worker started.");
