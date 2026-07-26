const { migrate } = require("drizzle-orm/postgres-js/migrator");
const { db, client } = require("./index");

async function run() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations complete.");
  await client.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
