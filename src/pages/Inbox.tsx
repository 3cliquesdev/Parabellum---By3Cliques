import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Mail, MessageSquare, Send } from "lucide-react";

const conversations = [
  {
    id: 1,
    contact: "João Silva",
    channel: "email",
    lastMessage: "Podemos agendar uma demo?",
    time: "há 5m",
    unread: true,
  },
  {
    id: 2,
    contact: "Maria Santos",
    channel: "whatsapp",
    lastMessage: "Obrigada pela proposta!",
    time: "há 1h",
    unread: true,
  },
  {
    id: 3,
    contact: "Pedro Costa",
    channel: "email",
    lastMessage: "Ansioso pela nossa reunião",
    time: "há 3h",
    unread: false,
  },
];

export default function Inbox() {
  return (
    <div className="flex h-screen">
      {/* Conversations List */}
      <div className="w-96 border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="mb-4 text-xl font-bold text-foreground">Caixa de Entrada</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="divide-y divide-border">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              className="w-full p-4 text-left transition-colors hover:bg-secondary"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {conv.contact.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{conv.contact}</p>
                    <div className="flex items-center gap-1">
                      {conv.channel === "email" ? (
                        <Mail className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground capitalize">
                        {conv.channel}
                      </span>
                    </div>
                  </div>
                </div>
                {conv.unread && (
                  <Badge variant="default" className="h-5 w-5 rounded-full p-0 flex items-center justify-center">
                    1
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{conv.lastMessage}</p>
              <p className="mt-1 text-xs text-muted-foreground">{conv.time}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Message View */}
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border p-4">
          <h3 className="font-semibold text-foreground">João Silva</h3>
          <p className="text-sm text-muted-foreground">joao@exemplo.com</p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                JS
              </div>
              <Card className="max-w-md p-3">
                <p className="text-sm text-foreground">
                  Oi! Estou interessado na sua solução de CRM. Podemos agendar uma demo?
                </p>
                <p className="mt-2 text-xs text-muted-foreground">10:30</p>
              </Card>
            </div>

            <div className="flex flex-row-reverse gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                EU
              </div>
              <Card className="max-w-md bg-primary p-3">
                <p className="text-sm text-primary-foreground">
                  Com certeza! Ficarei feliz em mostrar o sistema. Que dia funciona melhor para você?
                </p>
                <p className="mt-2 text-xs text-primary-foreground/70">10:32</p>
              </Card>
            </div>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input placeholder="Digite sua mensagem..." className="flex-1" />
            <Button size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}