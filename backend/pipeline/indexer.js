const { randomUUID } = require("crypto");
const { eq } = require("drizzle-orm");
const { db, schema } = require("../db");
const { qdrant, CONFIG } = require("../config");
const { extractSourceText } = require("../extractors");
const { chunkText } = require("./chunker");
const { mapChunkToPosition } = require("./positionMapper");
const { embedBatch } = require("../embeddings");

async function ensureCollection() {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === CONFIG.qdrantCollection);
  if (!exists) {
    await qdrant.createCollection(CONFIG.qdrantCollection, {
      vectors: { size: CONFIG.embeddingDims, distance: "Cosine" },
    });
  }
}

// Full indexing pipeline for one source: extract -> chunk -> embed -> store.
async function indexSource(sourceId) {
  const [row] = await db
    .select({ source: schema.sources, userId: schema.notebooks.userId })
    .from(schema.sources)
    .innerJoin(schema.notebooks, eq(schema.sources.notebookId, schema.notebooks.id))
    .where(eq(schema.sources.id, sourceId));
  if (!row) throw new Error("Source not found");

  const source = row.source;
  const userId = row.userId;

  await db
    .update(schema.sources)
    .set({ status: "processing", statusError: null })
    .where(eq(schema.sources.id, sourceId));

  // 1) Extract plain text (+ positional segments: pages, timestamps, etc)
  const { fullText, segments } = await extractSourceText(source);
  if (!fullText || !fullText.trim()) {
    throw new Error("No text could be extracted from this source.");
  }

  await db
    .insert(schema.sourceContents)
    .values({ sourceId, rawText: fullText, segments })
    .onConflictDoUpdate({
      target: schema.sourceContents.sourceId,
      set: { rawText: fullText, segments },
    });

  // 2) Chunk the text, each chunk carrying its offset in fullText
  const chunkPieces = await chunkText(fullText);
  if (chunkPieces.length === 0) {
    throw new Error("Text produced no chunks.");
  }

  // Replace any previous chunks for this source (e.g. on reprocessing)
  await db.delete(schema.chunks).where(eq(schema.chunks.sourceId, sourceId));

  const insertedChunks = await db
    .insert(schema.chunks)
    .values(
      chunkPieces.map((chunk, i) => {
        const position = mapChunkToPosition(chunk.start, segments);
        return {
          sourceId,
          chunkIndex: i,
          text: chunk.text,
          tokenCount: Math.round(chunk.text.length / 4),
          pageNumber: position.pageNumber,
          startTimeSeconds: position.startTimeSeconds,
          startOffset: chunk.start,
          endOffset: chunk.end,
        };
      })
    )
    .returning();

  // 3) Embed chunks
  const vectors = await embedBatch(insertedChunks.map((c) => c.text));

  // 4) Store in Qdrant
  await ensureCollection();
  const points = insertedChunks.map((chunk, i) => ({
    id: randomUUID(),
    vector: vectors[i],
    payload: {
      user_id: userId,
      notebook_id: source.notebookId,
      source_id: source.id,
      chunk_id: chunk.id,
      chunk_index: chunk.chunkIndex,
      text: chunk.text,
      page_number: chunk.pageNumber,
      start_time_seconds: chunk.startTimeSeconds,
      start_offset: chunk.startOffset,
      end_offset: chunk.endOffset,
    },
  }));
  await qdrant.upsert(CONFIG.qdrantCollection, { points });

  await db.update(schema.sources).set({ status: "ready" }).where(eq(schema.sources.id, sourceId));

  return { chunksIndexed: points.length };
}

module.exports = { indexSource };
