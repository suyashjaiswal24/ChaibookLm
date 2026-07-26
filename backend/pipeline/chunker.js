const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { CONFIG } = require("../config");

// Splits full text into overlapping chunks for embedding. Also locates each
// chunk's character range in the original fullText (searching forward from
// the end of the previous match) so callers can map chunks back to a
// source's positional segments (PDF pages, video timestamps, etc).
async function chunkText(fullText) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CONFIG.chunkSize,
    chunkOverlap: CONFIG.chunkOverlap,
  });
  const chunkTexts = await splitter.splitText(fullText);

  let searchFrom = 0;
  return chunkTexts.map((chunkContent) => {
    let start = fullText.indexOf(chunkContent, searchFrom);
    if (start === -1) {
      // Splitter may have trimmed/altered whitespace slightly; fall back to
      // searching from the start rather than losing offset tracking entirely.
      start = fullText.indexOf(chunkContent);
    }
    if (start === -1) {
      return { text: chunkContent, start: null, end: null };
    }

    const end = start + chunkContent.length;
    searchFrom = start + 1; // allow overlapping chunks to be found again
    return { text: chunkContent, start, end };
  });
}

module.exports = { chunkText };
