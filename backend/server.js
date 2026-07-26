// Simple backend for ChaibookLM.
// For now, every source type just gets logged to the console.

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = 3001;

// Store uploaded files in the "uploads" folder, keep the original name.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());

function logSource(type, details) {
  console.log("\n========== NEW SOURCE ADDED ==========");
  console.log("Type:", type);
  console.log("Details:", details);
  console.log("Time:", new Date().toISOString());
  console.log("=======================================\n");
}

// 1. PDF upload
app.post("/api/upload/pdf", upload.single("file"), (req, res) => {
  logSource("PDF", {
    originalName: req.file.originalname,
    savedAs: req.file.filename,
    size: req.file.size,
  });
  res.json({ message: "PDF received and logged." });
});

// 2. Plain text (either pasted text or a .txt file)
app.post("/api/upload/text", upload.single("file"), (req, res) => {
  if (req.file) {
    logSource("Plain Text (file)", {
      originalName: req.file.originalname,
      savedAs: req.file.filename,
      size: req.file.size,
    });
  } else {
    logSource("Plain Text (pasted)", { text: req.body.text });
  }
  res.json({ message: "Text received and logged." });
});

// 3. Website URL
app.post("/api/upload/url", (req, res) => {
  logSource("Website URL", { url: req.body.url });
  res.json({ message: "URL received and logged." });
});

// 4. YouTube video
app.post("/api/upload/youtube", (req, res) => {
  logSource("YouTube Video", { url: req.body.url });
  res.json({ message: "YouTube link received and logged." });
});

// 5. VTT / transcript file
app.post("/api/upload/vtt", upload.single("file"), (req, res) => {
  logSource("VTT / Transcript File", {
    originalName: req.file.originalname,
    savedAs: req.file.filename,
    size: req.file.size,
  });
  res.json({ message: "Transcript file received and logged." });
});

app.listen(PORT, () => {
  console.log(`ChaibookLM backend running on http://localhost:${PORT}`);
});
