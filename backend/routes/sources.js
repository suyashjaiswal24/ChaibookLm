const express = require("express");
const multer = require("multer");
const path = require("path");
const { eq, and, desc } = require("drizzle-orm");
const { db, schema } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { enqueueSourceProcessing } = require("../queues/sourceQueue");
const { qdrant, CONFIG } = require("../config");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Confirms the notebook exists and belongs to the current user.
async function getOwnedNotebook(notebookId, userId) {
  const [notebook] = await db
    .select()
    .from(schema.notebooks)
    .where(and(eq(schema.notebooks.id, notebookId), eq(schema.notebooks.userId, userId)));
  return notebook;
}

// List sources in a notebook
router.get("/", async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const rows = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.notebookId, notebook.id))
    .orderBy(desc(schema.sources.createdAt));
  res.json(rows);
});

// Add a PDF source
router.post("/pdf", upload.single("file"), async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const [source] = await db
    .insert(schema.sources)
    .values({
      notebookId: notebook.id,
      title: req.file.originalname,
      sourceType: "pdf",
      storagePath: req.file.filename,
    })
    .returning();
  await enqueueSourceProcessing(source.id);
  res.status(201).json(source);
});

// Add a plain text source
router.post("/text", express.json(), async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });
  const { text, title } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: "Text is required" });

  const [source] = await db
    .insert(schema.sources)
    .values({
      notebookId: notebook.id,
      title: title || text.slice(0, 40),
      sourceType: "text",
      content: text,
    })
    .returning();
  await enqueueSourceProcessing(source.id);
  res.status(201).json(source);
});

// Add a website URL source
router.post("/url", express.json(), async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });
  const { url } = req.body;
  if (!url || !url.trim()) return res.status(400).json({ error: "URL is required" });

  const [source] = await db
    .insert(schema.sources)
    .values({ notebookId: notebook.id, title: url, sourceType: "url", url })
    .returning();
  await enqueueSourceProcessing(source.id);
  res.status(201).json(source);
});

// Add a YouTube video source
router.post("/youtube", express.json(), async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });
  const { url } = req.body;
  if (!url || !url.trim()) return res.status(400).json({ error: "URL is required" });

  const [source] = await db
    .insert(schema.sources)
    .values({ notebookId: notebook.id, title: url, sourceType: "youtube", url })
    .returning();
  await enqueueSourceProcessing(source.id);
  res.status(201).json(source);
});

// Add a VTT / transcript file source
router.post("/vtt", upload.single("file"), async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const [source] = await db
    .insert(schema.sources)
    .values({
      notebookId: notebook.id,
      title: req.file.originalname,
      sourceType: "vtt",
      storagePath: req.file.filename,
    })
    .returning();
  await enqueueSourceProcessing(source.id);
  res.status(201).json(source);
});

// Stream the original uploaded file (PDF/VTT) for the Source Viewer.
// Auth + notebook ownership checked, so files aren't served publicly.
router.get("/:sourceId/file", async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const [source] = await db
    .select()
    .from(schema.sources)
    .where(and(eq(schema.sources.id, req.params.sourceId), eq(schema.sources.notebookId, notebook.id)));
  if (!source || !source.storagePath) return res.status(404).json({ error: "File not found" });

  res.sendFile(path.join(__dirname, "..", "uploads", source.storagePath));
});

// Get a source's full extracted content + positional segments (for the
// Source Viewer to highlight/jump to the cited spot).
router.get("/:sourceId/content", async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const [source] = await db
    .select()
    .from(schema.sources)
    .where(and(eq(schema.sources.id, req.params.sourceId), eq(schema.sources.notebookId, notebook.id)));
  if (!source) return res.status(404).json({ error: "Source not found" });

  const [content] = await db
    .select()
    .from(schema.sourceContents)
    .where(eq(schema.sourceContents.sourceId, source.id));

  res.json({ source, content: content || null });
});

// Re-index a source: wipes its chunks/Qdrant points and re-enqueues the
// full extract -> chunk -> embed pipeline.
router.post("/:sourceId/reindex", async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const [source] = await db
    .select()
    .from(schema.sources)
    .where(and(eq(schema.sources.id, req.params.sourceId), eq(schema.sources.notebookId, notebook.id)));
  if (!source) return res.status(404).json({ error: "Source not found" });

  await deleteQdrantPointsForSource(source.id);
  await db.update(schema.sources).set({ status: "pending", statusError: null }).where(eq(schema.sources.id, source.id));
  await enqueueSourceProcessing(source.id);

  res.json({ message: "Source queued for re-indexing" });
});

// Delete a source
router.delete("/:sourceId", async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const [deleted] = await db
    .delete(schema.sources)
    .where(and(eq(schema.sources.id, req.params.sourceId), eq(schema.sources.notebookId, notebook.id)))
    .returning();

  if (!deleted) return res.status(404).json({ error: "Source not found" });

  await deleteQdrantPointsForSource(deleted.id);

  res.json({ message: "Source deleted" });
});

async function deleteQdrantPointsForSource(sourceId) {
  try {
    await qdrant.delete(CONFIG.qdrantCollection, {
      filter: { must: [{ key: "source_id", match: { value: sourceId } }] },
    });
  } catch (err) {
    // Collection may not exist yet if nothing has ever been indexed.
    console.error(`Failed to delete Qdrant points for source ${sourceId}:`, err.message);
  }
}

module.exports = router;
