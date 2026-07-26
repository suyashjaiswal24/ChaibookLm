const { pgTable, uuid, text, timestamp, pgEnum } = require("drizzle-orm/pg-core");

const sourceType = pgEnum("source_type", ["pdf", "text", "url", "youtube", "vtt"]);
const sourceStatus = pgEnum("source_status", ["pending", "ready", "failed"]);

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
  status: sourceStatus("status").default("ready").notNull(),
  url: text("url"),
  storagePath: text("storage_path"),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

module.exports = { sourceType, sourceStatus, users, notebooks, sources };
