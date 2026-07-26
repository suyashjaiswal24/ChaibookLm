const { YoutubeTranscript } = require("youtube-transcript");

// Fetches the auto-generated/uploaded transcript for a YouTube video URL.
async function extractYoutube(source) {
  const segments = await YoutubeTranscript.fetchTranscript(source.url);
  return segments.map((s) => s.text).join(" ");
}

module.exports = { extractYoutube };
