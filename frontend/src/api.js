export const API_BASE = "http://localhost:3002/api";

async function request(getToken, path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.isJson ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function listNotebooks(getToken) {
  return request(getToken, "/notebooks");
}

export function createNotebook(getToken, title, description) {
  return request(getToken, "/notebooks", {
    method: "POST",
    isJson: true,
    body: JSON.stringify({ title, description }),
  });
}

export function deleteNotebook(getToken, notebookId) {
  return request(getToken, `/notebooks/${notebookId}`, { method: "DELETE" });
}

export function listSources(getToken, notebookId) {
  return request(getToken, `/notebooks/${notebookId}/sources`);
}

export function addSource(getToken, notebookId, type, body, isJson) {
  return request(getToken, `/notebooks/${notebookId}/sources/${type}`, {
    method: "POST",
    isJson,
    body: isJson ? JSON.stringify(body) : body,
  });
}

export function getConversation(getToken, notebookId) {
  return request(getToken, `/notebooks/${notebookId}/ask`);
}

export function askQuestion(getToken, notebookId, question) {
  return request(getToken, `/notebooks/${notebookId}/ask`, {
    method: "POST",
    isJson: true,
    body: JSON.stringify({ question }),
  });
}
