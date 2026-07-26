const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const AdmZip = require("adm-zip");
const { eq, and, desc } = require("drizzle-orm");
const { db, schema } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { enqueueSourceProcessing } = require("../queues/sourceQueue");
const { qdrant, CONFIG } = require("../config");
const { withRetry } = require("../pipeline/withRetry");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Zip uploads are read into memory just long enough to extract the VTT
// files inside; the zip itself isn't kept on disk.
const uploadZip = multer({ storage: multer.memoryStorage() });

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

// Add a whole course's worth of VTT/transcript files from one zip upload.
// Every .vtt/.srt file found in the zip (including in subfolders) becomes
// its own source, titled with its folder path so e.g. "Week 1/Lecture 2.vtt"
// stays distinguishable from other weeks' "Lecture 2.vtt".
router.post("/vtt-zip", uploadZip.single("file"), async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let zip;
  try {
    zip = new AdmZip(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: "Could not read zip file" });
  }

  // Ignore macOS zip cruft (__MACOSX/ resource-fork folder, .DS_Store,
  // and AppleDouble "._filename" shadow files) so only real transcripts count.
  const isMacJunk = (entryName) =>
    entryName.startsWith("__MACOSX/") || entryName.includes("/._") || entryName.startsWith("._") || entryName.endsWith(".DS_Store");

  const transcriptEntries = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && !isMacJunk(entry.entryName) && /\.(vtt|srt)$/i.test(entry.entryName));

  if (transcriptEntries.length === 0) {
    return res.status(400).json({ error: "No .vtt or .srt files found in the zip" });
  }

  const createdSources = [];
  for (const entry of transcriptEntries) {
    const title = entry.entryName.replace(/\\/g, "/").replace(/\/+$/, "");
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${title.replace(/\//g, "_")}`;
    const destPath = path.join(__dirname, "..", "uploads", filename);

    await fs.writeFile(destPath, entry.getData());

    const [source] = await db
      .insert(schema.sources)
      .values({
        notebookId: notebook.id,
        title,
        sourceType: "vtt",
        storagePath: filename,
      })
      .returning();

    await enqueueSourceProcessing(source.id);
    createdSources.push(source);
  }

  res.status(201).json({ sources: createdSources, count: createdSources.length });
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
  await db.update(schema.sources).set({ status: "uploading", statusError: null }).where(eq(schema.sources.id, source.id));
  await enqueueSourceProcessing(source.id);

  res.json({ message: "Source queued for re-indexing" });
});

// Delete every source in the notebook at once.
router.delete("/", async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const deleted = await db
    .delete(schema.sources)
    .where(eq(schema.sources.notebookId, notebook.id))
    .returning();

  await Promise.all(deleted.map((s) => deleteQdrantPointsForSource(s.id)));

  res.json({ message: "All sources deleted", count: deleted.length });
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
    await withRetry(() =>
      qdrant.delete(CONFIG.qdrantCollection, {
        filter: { must: [{ key: "source_id", match: { value: sourceId } }] },
      })
    );
  } catch (err) {
    // Collection may not exist yet if nothing has ever been indexed.
    console.error(`Failed to delete Qdrant points for source ${sourceId}:`, err.message);
  }
}

module.exports = router;
