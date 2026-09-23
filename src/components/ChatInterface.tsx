import * as React from "react";
import { chatAboutConstruction } from "@/lib/chat.functions";
import type { ChatMessage } from "@/lib/chat.functions";
import { Send, Bot, User, Loader2 } from "lucide-react";

export default function ChatInterface() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your AI assistant for the UK Construction Price Index. " +
        "You can ask me questions like:\n" +
        '• "Compare the build cost of a 150,000 sqft industrial shed from 2022 to 2026 in South West England"\n' +
        '• "What was the price per sqft for offices in London in Q2 2024?"\n' +
        '• "Show me the trend for industrial logistics sheds in the North West"\n\n' +
        "What would you like to know?",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await chatAboutConstruction({
        data: {
          message: input.trim(),
          history: messages,
        },
      });

      setMessages((prev) => [...prev, { role: "assistant", content: response.response }]);
    } catch (err: unknown) {
      const errorMsg =
        (err instanceof Error ? err.message : String(err)) ??
        "Sorry, I encountered an error. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cpi-blue to-cpi-green flex items-center justify-center flex-shrink-0">
                <Bot size={18} className="text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-cpi-blue text-white rounded-br-none"
                  : "bg-gray-100 text-gray-900 rounded-bl-none"
              }`}
            >
              {msg.content.split("\n").map((line: string, i: number) => (
                <p key={i}>{line}</p>
              ))}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-gray-700" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cpi-blue to-cpi-green flex items-center justify-center flex-shrink-0">
              <Bot size={18} className="text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg rounded-bl-none px-4 py-3">
              <Loader2 size={16} className="animate-spin text-gray-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about build costs, price trends, comparisons…"
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cpi-blue focus:border-transparent text-sm disabled:opacity-50"
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary">
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
