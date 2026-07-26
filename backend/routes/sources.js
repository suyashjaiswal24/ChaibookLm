const express = require("express");
const multer = require("multer");
const path = require("path");
const { eq, and, desc } = require("drizzle-orm");
const { db, schema } = require("../db");
const { requireAuth } = require("../middleware/auth");

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
  res.status(201).json(source);
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
  res.json({ message: "Source deleted" });
});

module.exports = router;
