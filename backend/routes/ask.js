const express = require("express");
const { eq, and } = require("drizzle-orm");
const { db, schema } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { answerQuery } = require("../query/cragLoop");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);
router.use(express.json());

// POST /api/notebooks/:notebookId/ask  { question: string }
router.post("/", async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  const [notebook] = await db
    .select()
    .from(schema.notebooks)
    .where(and(eq(schema.notebooks.id, req.params.notebookId), eq(schema.notebooks.userId, req.user.id)));
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  try {
    const result = await answerQuery(question, notebook.id);
    res.json(result);
  } catch (err) {
    console.error("Ask error:", err);
    res.status(500).json({ error: "Failed to answer question" });
  }
});

module.exports = router;
