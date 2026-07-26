const { YoutubeTranscript } = require("youtube-transcript");

const SEGMENT_JOINER = " ";

// Fetches the transcript for a YouTube video URL, tracking each caption
// segment's start time (in seconds) and character range in the joined
// fullText so chunks can later be mapped back to a video timestamp.
async function extractYoutube(source) {
  const captionSegments = await YoutubeTranscript.fetchTranscript(source.url);

  const segments = [];
  let cursor = 0;
  const texts = [];

  for (const seg of captionSegments) {
    const start = cursor;
    const end = start + seg.text.length;
    segments.push({ startTimeSeconds: seg.offset / 1000, start, end });
    cursor = end + SEGMENT_JOINER.length;
    texts.push(seg.text);
  }

  const fullText = texts.join(SEGMENT_JOINER);
  return { fullText, segments };
}

module.exports = { extractYoutube };
