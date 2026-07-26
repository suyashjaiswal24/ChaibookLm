const express = require("express");
const { eq, and, asc } = require("drizzle-orm");
const { db, schema } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { answerQuery } = require("../query/cragLoop");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);
router.use(express.json());

const MAX_HISTORY_MESSAGES = 10;

async function getOwnedNotebook(notebookId, userId) {
  const [notebook] = await db
    .select()
    .from(schema.notebooks)
    .where(and(eq(schema.notebooks.id, notebookId), eq(schema.notebooks.userId, userId)));
  return notebook;
}

// Every notebook has exactly one ongoing conversation, created lazily.
// Uses an upsert so two concurrent requests for the same new notebook
// can't both try to insert and violate the unique constraint on notebook_id.
async function getOrCreateConversation(notebookId) {
  const [conversation] = await db
    .insert(schema.conversations)
    .values({ notebookId })
    .onConflictDoUpdate({
      target: schema.conversations.notebookId,
      set: { notebookId },
    })
    .returning();
  return conversation;
}

// GET /api/notebooks/:notebookId/ask -> conversation history
router.get("/", async (req, res) => {
  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const conversation = await getOrCreateConversation(notebook.id);
  const history = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversation.id))
    .orderBy(asc(schema.messages.createdAt));

  res.json({ conversationId: conversation.id, messages: history });
});

// POST /api/notebooks/:notebookId/ask  { question: string }
router.post("/", async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  const notebook = await getOwnedNotebook(req.params.notebookId, req.user.id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const conversation = await getOrCreateConversation(notebook.id);

  const priorMessages = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversation.id))
    .orderBy(asc(schema.messages.createdAt));

  const history = priorMessages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  await db.insert(schema.messages).values({
    conversationId: conversation.id,
    role: "user",
    content: question,
  });

  try {
    const result = await answerQuery(question, notebook.id, history);

    await db.insert(schema.messages).values({
      conversationId: conversation.id,
      role: "assistant",
      content: result.answer,
    });

    res.json({ ...result, conversationId: conversation.id });
  } catch (err) {
    console.error("Ask error:", err);
    res.status(500).json({ error: "Failed to answer question" });
  }
});

module.exports = router;
