const { pgTable, uuid, text, timestamp, pgEnum, integer, real, jsonb } = require("drizzle-orm/pg-core");

const sourceType = pgEnum("source_type", ["pdf", "text", "url", "youtube", "vtt"]);
const sourceStatus = pgEnum("source_status", [
  "uploading",
  "extracting",
  "chunking",
  "embedding",
  "ready",
  "failed",
]);
const messageRole = pgEnum("message_role", ["user", "assistant"]);

const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const notebooks = pgTable("notebooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  notebookId: uuid("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sourceType: sourceType("source_type").notNull(),
  status: sourceStatus("status").default("uploading").notNull(),
  statusError: text("status_error"),
  url: text("url"),
  storagePath: text("storage_path"),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Full extracted plain text for a source (one row per source), plus the
// raw position segments (pages/timestamps/offsets) used to locate chunks
// back in the original document. See extractors/index.js for the shape.
const sourceContents = pgTable("source_contents", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" })
    .unique(),
  rawText: text("raw_text").notNull(),
  segments: jsonb("segments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chunked pieces of a source's text, each later embedded into Qdrant.
// Positional fields are populated depending on the source type, so a
// citation can jump back to the right spot in the original source:
//   pdf      -> pageNumber
//   youtube  -> startTimeSeconds
//   text/vtt/url -> startOffset/endOffset (character offsets into raw_text)
const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  tokenCount: integer("token_count"),
  pageNumber: integer("page_number"),
  startTimeSeconds: real("start_time_seconds"),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One ongoing conversation per notebook.
const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  notebookId: uuid("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" })
    .unique(),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRole("role").notNull(),
  content: text("content").notNull(),
  // Citation payload for assistant messages (source/page/timestamp info the
  // frontend needs to render "sources for this answer" and the Source Viewer).
  citations: jsonb("citations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

module.exports = {
  sourceType,
  sourceStatus,
  messageRole,
  users,
  notebooks,
  sources,
  sourceContents,
  chunks,
  conversations,
  messages,
};
