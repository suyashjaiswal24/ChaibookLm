const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { CONFIG } = require("../config");

// Splits full text into overlapping chunks for embedding.
async function chunkText(text) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CONFIG.chunkSize,
    chunkOverlap: CONFIG.chunkOverlap,
  });
  return splitter.splitText(text);
}

module.exports = { chunkText };
