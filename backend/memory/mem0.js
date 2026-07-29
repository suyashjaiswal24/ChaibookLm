// Thin REST wrapper around the Mem0 API (https://api.mem0.ai), used instead
// of the mem0ai npm package because it pulls in a conflicting @langchain/core
// peer dependency that clashes with our @langchain/textsplitters version.
//
// Memories are scoped per-notebook via `run_id` (not per-user), matching
// this app's isolation model: each notebook is its own knowledge base, so a
// fact said in one notebook's conversation shouldn't leak into another's.

const MEM0_API_BASE = "https://api.mem0.ai";
const MEM0_API_KEY = process.env.MEM0_API_KEY;

async function mem0Request(path, body) {
  const res = await fetch(`${MEM0_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${MEM0_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mem0 API error (${res.status}): ${text}`);
  }
  return res.json();
}

// Extracts and stores durable facts from a user/assistant exchange, scoped
// to this notebook's conversation (run_id). Mem0 decides internally what's
// actually worth remembering (infer: true) rather than storing verbatim.
async function addMemory(notebookId, messages) {
  if (!MEM0_API_KEY) return; // memory is optional; skip silently if unconfigured
  try {
    await mem0Request("/v3/memories/add/", {
      messages,
      run_id: notebookId,
      infer: true,
    });
  } catch (err) {
    console.error("Mem0 addMemory failed:", err.message);
  }
}

// Searches this notebook's remembered facts for ones relevant to the
// current question, so facts from far outside the recent-message window
// (e.g. message #1 of a 50-message conversation) can still be recalled.
async function searchMemory(notebookId, query, topK = 5) {
  if (!MEM0_API_KEY) return [];
  try {
    const data = await mem0Request("/v3/memories/search/", {
      query,
      filters: { run_id: notebookId },
      top_k: topK,
    });
    return (data.results || []).map((r) => r.memory);
  } catch (err) {
    console.error("Mem0 searchMemory failed:", err.message);
    return [];
  }
}

module.exports = { addMemory, searchMemory };
