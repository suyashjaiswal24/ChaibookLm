const { extractPdf } = require("./pdf");
const { extractText } = require("./text");
const { extractUrl } = require("./url");
const { extractYoutube } = require("./youtube");
const { extractVtt } = require("./vtt");

const EXTRACTORS = {
  pdf: extractPdf,
  text: extractText,
  url: extractUrl,
  youtube: extractYoutube,
  vtt: extractVtt,
};

// Runs the correct extractor for a source's type and returns its plain text.
async function extractSourceText(source) {
  const extractor = EXTRACTORS[source.sourceType];
  if (!extractor) {
    throw new Error(`No extractor for source type: ${source.sourceType}`);
  }
  return extractor(source);
}

module.exports = { extractSourceText };
