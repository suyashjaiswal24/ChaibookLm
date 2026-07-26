const { pgTable, uuid, text, timestamp, pgEnum, integer } = require("drizzle-orm/pg-core");

const sourceType = pgEnum("source_type", ["pdf", "text", "url", "youtube", "vtt"]);
const sourceStatus = pgEnum("source_status", ["pending", "processing", "ready", "failed"]);

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
  status: sourceStatus("status").default("pending").notNull(),
  statusError: text("status_error"),
  url: text("url"),
  storagePath: text("storage_path"),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Full extracted plain text for a source (one row per source).
const sourceContents = pgTable("source_contents", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" })
    .unique(),
  rawText: text("raw_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chunked pieces of a source's text, each later embedded into Qdrant.
const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

module.exports = {
  sourceType,
  sourceStatus,
  users,
  notebooks,
  sources,
  sourceContents,
  chunks,
};
