const fs = require("fs/promises");
const path = require("path");

const CUE_NUMBER_LINE = /^\d+$/;
// Matches "00:01:02.500 --> 00:01:05.000" (hours part optional)
const TIMESTAMP_LINE = /^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->/;
const CUE_JOINER = " ";

function timestampToSeconds(hours, minutes, seconds, millis) {
  const h = hours ? parseInt(hours, 10) : 0;
  const m = parseInt(minutes, 10);
  const s = parseInt(seconds, 10);
  const ms = parseInt(millis, 10);
  return h * 3600 + m * 60 + s + ms / 1000;
}

// Parses a .vtt/.srt transcript file into plain spoken text, keeping each
// cue's start timestamp (in seconds) and character range in the joined
// fullText so chunks can later be mapped back to a point in the video.
async function extractVtt(source) {
  const filePath = path.join(__dirname, "..", "uploads", source.storagePath);
  const raw = await fs.readFile(filePath, "utf-8");
  const lines = raw.split(/\r?\n/);

  const segments = [];
  const texts = [];
  let cursor = 0;
  let currentStartSeconds = null;
  let currentTextLines = [];

  function flushCue() {
    if (currentStartSeconds === null || currentTextLines.length === 0) return;
    const cueText = currentTextLines.join(" ").trim();
    if (!cueText) return;

    const start = cursor;
    const end = start + cueText.length;
    segments.push({ startTimeSeconds: currentStartSeconds, start, end });
    cursor = end + CUE_JOINER.length;
    texts.push(cueText);
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const timestampMatch = trimmed.match(TIMESTAMP_LINE);

    if (timestampMatch) {
      flushCue();
      const [, hours, minutes, seconds, millis] = timestampMatch;
      currentStartSeconds = timestampToSeconds(hours, minutes, seconds, millis);
      currentTextLines = [];
      continue;
    }

    if (!trimmed || trimmed === "WEBVTT" || CUE_NUMBER_LINE.test(trimmed)) {
      continue;
    }

    currentTextLines.push(trimmed);
  }
  flushCue();

  const fullText = texts.join(CUE_JOINER);
  return { fullText, segments };
}

module.exports = { extractVtt };
