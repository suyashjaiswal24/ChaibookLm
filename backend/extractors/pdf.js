const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");

const PAGE_JOINER = "\n\n";

// Reads the uploaded PDF from disk and extracts plain text, tracking the
// character range each page occupies in the joined fullText so chunks can
// later be mapped back to a page number.
async function extractPdf(source) {
  const filePath = path.join(__dirname, "..", "uploads", source.storagePath);
  const buffer = await fs.readFile(filePath);

  const segments = [];
  let pageNumber = 0;
  let cursor = 0;
  const pageTexts = [];

  await pdfParse(buffer, {
    // pdf-parse calls this once per page during parsing; we use it purely
    // to observe each page's text and its offset in the final joined string,
    // then hand the text back so pdf-parse's own join produces fullText.
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");

      pageNumber += 1;
      const start = cursor;
      const end = start + pageText.length;
      segments.push({ pageNumber, start, end });
      cursor = end + PAGE_JOINER.length;
      pageTexts.push(pageText);

      return pageText;
    },
  });

  const fullText = pageTexts.join(PAGE_JOINER);
  return { fullText, segments };
}

module.exports = { extractPdf };
