const fs = require("fs/promises");
const path = require("path");

const TIMESTAMP_LINE = /-->/;
const CUE_NUMBER_LINE = /^\d+$/;

// Parses a .vtt/.srt transcript file into plain spoken text,
// dropping the WEBVTT header, cue numbers, and timestamp lines.
async function extractVtt(source) {
  const filePath = path.join(__dirname, "..", "uploads", source.storagePath);
  const raw = await fs.readFile(filePath, "utf-8");

  const lines = raw.split(/\r?\n/);
  const textLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed === "WEBVTT") return false;
    if (CUE_NUMBER_LINE.test(trimmed)) return false;
    if (TIMESTAMP_LINE.test(trimmed)) return false;
    return true;
  });

  return textLines.join(" ").replace(/\s+/g, " ").trim();
}

module.exports = { extractVtt };
