const { createClerkClient, verifyToken } = require("@clerk/backend");
const { eq } = require("drizzle-orm");
const { db, schema } = require("../db");

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Verifies the Clerk session token from the Authorization header,
// then finds or creates a matching row in our own "users" table.
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { sub: clerkUserId } = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    let [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkUserId, clerkUserId));

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

      [user] = await db
        .insert(schema.users)
        .values({ clerkUserId, email, name })
        .returning();
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
