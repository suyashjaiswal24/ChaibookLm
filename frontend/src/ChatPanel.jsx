import { useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { groupCitations } from "@/lib/citations";
import { getConversation, askQuestionStream } from "./api.js";

function ChatPanel({ notebookId, hasReadySources, onLatestCitations }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    refresh();
  }, [notebookId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking, streamingText]);

  // Whenever messages change, surface the most recent assistant answer's
  // citations to the parent, which renders them in the right-hand column.
  // History rows from the DB use "citations"; a freshly-appended live
  // answer uses "sources" — both are normalized here.
  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && (m.citations?.length || m.sources?.length));
    const citationSources = lastAssistant?.citations ?? lastAssistant?.sources;
    onLatestCitations?.(citationSources ? groupCitations(citationSources) : []);
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
    setStreamingText("");

    let fullText = "";
    try {
      await askQuestionStream(getToken, notebookId, q, {
        onToken: (text) => {
          fullText += text;
          setStreamingText(fullText);
        },
        onDone: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullText, sources: data.sources, id: `temp-a-${Date.now()}` },
          ]);
          setStreamingText("");
          setAsking(false);
        },
        onError: (message) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${message}`, id: `temp-err-${Date.now()}` },
          ]);
          setStreamingText("");
          setAsking(false);
        },
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}`, id: `temp-err-${Date.now()}` },
      ]);
      setStreamingText("");
      setAsking(false);
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {loading ? (
          <EmptyState text="Loading conversation..." />
        ) : !hasReadySources ? (
          <EmptyState text="Add and process at least one source to start chatting." />
        ) : messages.length === 0 ? (
          <EmptyState text="Ask a question about this notebook's sources." />
        ) : (
          messages.map((m) => <ChatMessage key={m.id} message={m} userImageUrl={user?.imageUrl} />)
        )}
        {asking && (
          <ChatMessage
            message={{ role: "assistant", content: streamingText || "Thinking…" }}
            thinking={!streamingText}
          />
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleAsk} className="flex gap-2 border-t border-slate-200 bg-white p-4">
        <Input
          type="text"
          placeholder={hasReadySources ? "Ask a question..." : "No sources ready yet"}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={asking || !hasReadySources}
          className="flex-1"
        />
        <Button type="submit" disabled={asking || !hasReadySources || !question.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </main>
  );
}

function ChatMessage({ message, userImageUrl, thinking }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar>
        {isUser ? (
          userImageUrl ? (
            <img src={userImageUrl} alt="You" className="h-full w-full object-cover" />
          ) : (
            <AvatarFallback className="bg-brand-100 text-brand-700">You</AvatarFallback>
          )
        ) : (
          <AvatarFallback className="bg-slate-800 text-white">
            <Sparkles className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>

      <div
        className={
          isUser
            ? "max-w-[75%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white"
            : `max-w-[75%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 ${thinking ? "italic text-slate-400" : ""}`
        }
      >
        {isUser || thinking ? (
          message.content
        ) : (
          <div className="prose prose-sm prose-slate max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

export default ChatPanel;
