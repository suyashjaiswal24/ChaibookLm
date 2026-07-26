const cheerio = require("cheerio");

// Fetches a webpage and strips it down to readable plain text.
async function extractUrl(source) {
  const res = await fetch(source.url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL (status ${res.status})`);
  }
  const html = await res.text();

  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();

  return $("body").text().replace(/\s+/g, " ").trim();
}

module.exports = { extractUrl };
