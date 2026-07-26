import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { getConversation, askQuestion } from "./api.js";

function ChatPanel({ notebookId, hasReadySources }) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    refresh();
  }, [notebookId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function refresh() {
    setLoading(true);
    try {
      const data = await getConversation(getToken, notebookId);
      setMessages(data.messages);
    } finally {
      setLoading(false);
    }
  }

  async function handleAsk(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking || !hasReadySources) return;

    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: q, id: `temp-${Date.now()}` }]);
    setAsking(true);

    try {
      const result = await askQuestion(getToken, notebookId, q);
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer, id: `temp-a-${Date.now()}` }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}`, id: `temp-err-${Date.now()}` },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="chat-panel">
      <h2>Chat</h2>
      <div className="chat-messages">
        {loading ? (
          <p className="empty">Loading conversation...</p>
        ) : !hasReadySources ? (
          <p className="empty">Add and process at least one source to start chatting.</p>
        ) : messages.length === 0 ? (
          <p className="empty">Ask a question about this notebook's sources.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-message chat-message-${m.role}`}>
              {m.content}
            </div>
          ))
        )}
        {asking && <div className="chat-message chat-message-assistant chat-thinking">Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleAsk}>
        <input
          type="text"
          placeholder={hasReadySources ? "Ask a question..." : "No sources ready yet"}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={asking || !hasReadySources}
        />
        <button type="submit" disabled={asking || !hasReadySources || !question.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;
