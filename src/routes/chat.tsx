import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import ChatInterface from "@/components/ChatInterface";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <MessageCircle size={24} className="text-cpi-blue" />
          AI Chat — Ask About Tender Prices
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ask questions about UK tender price inflation forecasts: by region, by year, and how
          forecasts have been revised between reports.
        </p>
      </div>

      <div className="card">
        <ChatInterface />
      </div>
    </div>
  );
}
