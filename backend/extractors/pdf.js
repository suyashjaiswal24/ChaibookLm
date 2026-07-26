const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");

// Reads the uploaded PDF from disk and extracts its plain text.
async function extractPdf(source) {
  const filePath = path.join(__dirname, "..", "uploads", source.storagePath);
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

module.exports = { extractPdf };
