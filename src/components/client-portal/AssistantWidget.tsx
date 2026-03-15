import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, ExternalLink } from "lucide-react";
import { useClientAssistant } from "@/hooks/useClientAssistant";
import { usePublicTicketPortalConfig } from "@/hooks/usePublicTicketPortal";
import { ScrollArea } from "@/components/ui/scroll-area";

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-bl-sm max-w-fit" style={{ backgroundColor: "#f3f4f6" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-2 w-2 rounded-full"
          style={{
            backgroundColor: "#9ca3af",
            animation: `typing-bounce 1.4s infinite ${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, handoff, sendMessage, contactReady } = useClientAssistant();
  const { data: portalConfig } = usePublicTicketPortalConfig();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const whatsappNumber = portalConfig?.whatsapp_number;

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 flex flex-col overflow-hidden rounded-2xl shadow-2xl border"
          style={{
            width: 380,
            height: 520,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100vh - 100px)",
            backgroundColor: "#ffffff",
            borderColor: "#e5e7eb",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-white" />
              <span className="text-white font-semibold text-sm">Assistente Virtual</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ backgroundColor: "#f9fafb" }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          backgroundColor: "#2563eb",
                          color: "#ffffff",
                          borderBottomRightRadius: 4,
                        }
                      : {
                          backgroundColor: "#f3f4f6",
                          color: "#1f2937",
                          borderBottomLeftRadius: 4,
                        }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}

            {handoff && whatsappNumber && (
              <div className="flex justify-center pt-2">
                <a
                  href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: "#22c55e" }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Falar com Suporte no WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="shrink-0 flex items-center gap-2 px-3 py-3 border-t"
            style={{ borderColor: "#e5e7eb", backgroundColor: "#ffffff" }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={handoff ? "Aguarde o atendimento..." : "Digite sua mensagem..."}
              disabled={isLoading || handoff || !contactReady}
              className="flex-1 rounded-full border px-4 py-2 text-sm outline-none transition-colors disabled:opacity-50"
              style={{
                borderColor: "#d1d5db",
                backgroundColor: "#f9fafb",
                color: "#1f2937",
              }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || handoff || !contactReady}
              className="h-9 w-9 flex items-center justify-center rounded-full transition-colors disabled:opacity-40"
              style={{ backgroundColor: "#2563eb", color: "#ffffff" }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          width: 56,
          height: 56,
          background: "linear-gradient(135deg, #2563eb, #7c3aed)",
        }}
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </button>
    </>
  );
}
