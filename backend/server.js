require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");

const notebooksRouter = require("./routes/notebooks");
const sourcesRouter = require("./routes/sources");
const askRouter = require("./routes/ask");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use("/api/notebooks", notebooksRouter);
app.use("/api/notebooks/:notebookId/sources", sourcesRouter);
app.use("/api/notebooks/:notebookId/ask", askRouter);

// Unknown route
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler — catches anything forwarded via asyncHandler
// (DB errors, Qdrant errors, etc.) so a failure returns clean JSON instead
// of hanging the request or crashing the process.
app.use((err, req, res, next) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`ChaibookLM backend running on http://localhost:${PORT}`);
});
