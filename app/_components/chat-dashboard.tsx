"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Placeholder, ToolAnswer } from "./answer";

const EXAMPLES = [
  "which jackets came back as returns last week",
  "sales per day last 14 days",
  "what sold best since July 1",
  "show me each returned order last week",
  "are repeat customers growing",
];

export function ChatDashboard() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];

  function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    sendMessage({ text: q });
    setInput("");
  }

  return (
    <main className="dash">
      <h1>Ask about your store</h1>
      <p className="sub">Order history, May to October 2025.</p>

      {messages.length === 0 && (
        <div className="examples">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" onClick={() => ask(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="thread">
        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="bubble-user">
                {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
              </div>
            );
          }
          const tools = m.parts.filter((p) => p.type.startsWith("tool-"));
          const texts = m.parts.filter((p) => p.type === "text");
          return (
            <div key={m.id} className="assistant">
              {tools.map((p, i) => {
                const part = p as { type: string; state: string; output?: unknown };
                return (
                  <ToolAnswer
                    key={i}
                    name={part.type.slice("tool-".length)}
                    state={part.state}
                    output={part.output}
                  />
                );
              })}
              {texts.map((p, i) => (
                <p key={i} className="explain">
                  {p.type === "text" ? p.text : null}
                </p>
              ))}
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="assistant">
            <section className="answer-card">
              <header>
                <h2>Looking at your orders…</h2>
              </header>
              <Placeholder shape="bars" />
            </section>
          </div>
        )}

        {status === "streaming" && last?.role === "assistant" && !last.parts.some((p) => p.type.startsWith("tool-")) && (
          <p className="hint">Working on it…</p>
        )}

        {status === "error" && (
          <p className="error-note" role="alert">
            Something went wrong{error?.message ? `: ${friendly(error.message)}` : ""}. Try asking again.
          </p>
        )}
      </div>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="Ask about sales, returns or customers"
          aria-label="Your question"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
    </main>
  );
}

function friendly(message: string) {
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed?.error === "string") return parsed.error;
  } catch {}
  return message.length > 140 ? `${message.slice(0, 140)}…` : message;
}
