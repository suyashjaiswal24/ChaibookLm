const express = require("express");
const { eq, and, desc } = require("drizzle-orm");
const { db, schema } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// List all notebooks for the current user
router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(schema.notebooks)
    .where(eq(schema.notebooks.userId, req.user.id))
    .orderBy(desc(schema.notebooks.createdAt));
  res.json(rows);
});

// Create a new notebook
router.post("/", async (req, res) => {
  const { title, description } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const [notebook] = await db
    .insert(schema.notebooks)
    .values({ userId: req.user.id, title, description: description || null })
    .returning();

  res.status(201).json(notebook);
});

// Get one notebook (only if it belongs to the current user)
router.get("/:id", async (req, res) => {
  const [notebook] = await db
    .select()
    .from(schema.notebooks)
    .where(and(eq(schema.notebooks.id, req.params.id), eq(schema.notebooks.userId, req.user.id)));

  if (!notebook) return res.status(404).json({ error: "Notebook not found" });
  res.json(notebook);
});

// Delete a notebook
router.delete("/:id", async (req, res) => {
  const [deleted] = await db
    .delete(schema.notebooks)
    .where(and(eq(schema.notebooks.id, req.params.id), eq(schema.notebooks.userId, req.user.id)))
    .returning();

  if (!deleted) return res.status(404).json({ error: "Notebook not found" });
  res.json({ message: "Notebook deleted" });
});

module.exports = router;
