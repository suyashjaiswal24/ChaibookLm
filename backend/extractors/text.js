// Plain text sources already have their content stored directly on the row.
async function extractText(source) {
  return source.content || "";
}

module.exports = { extractText };
