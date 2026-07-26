const cheerio = require("cheerio");

// Fetches a webpage and strips it down to readable plain text. A single
// segment spanning the whole text lets the indexer compute character
// offsets for each chunk uniformly with other source types (the source
// viewer for URLs just opens the link rather than highlighting an offset).
async function extractUrl(source) {
  const res = await fetch(source.url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL (status ${res.status})`);
  }
  const html = await res.text();

  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();

  const fullText = $("body").text().replace(/\s+/g, " ").trim();
  return {
    fullText,
    segments: fullText ? [{ start: 0, end: fullText.length }] : [],
  };
}

module.exports = { extractUrl };
