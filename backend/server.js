require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");

const notebooksRouter = require("./routes/notebooks");
const sourcesRouter = require("./routes/sources");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use("/api/notebooks", notebooksRouter);
app.use("/api/notebooks/:notebookId/sources", sourcesRouter);

app.listen(PORT, () => {
  console.log(`ChaibookLM backend running on http://localhost:${PORT}`);
});
