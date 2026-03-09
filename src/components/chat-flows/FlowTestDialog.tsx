import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, MessageSquare, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface FlowTestDialogProps {
  open: boolean;
  onClose: () => void;
  flowId: string;
  flowName: string;
  /** If provided, auto-saves flow before starting test */
  onAutoSave?: () => Promise<void>;
}

export function FlowTestDialog({ open, onClose, flowId, flowName, onAutoSave }: FlowTestDialogProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["flow-test-conversations", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("conversations")
        .select("id, contact_id, status, channel, created_at, contacts:contact_id(first_name, last_name, phone)")
        .in("status", ["open", "waiting_human"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (debouncedSearch) {
        query = query.or(
          `contacts.first_name.ilike.%${debouncedSearch}%,contacts.last_name.ilike.%${debouncedSearch}%,contacts.phone.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleStartTest = async (conversationId: string, contactId?: string) => {
    setIsStarting(true);
    try {
      // 1. Auto-save flow if handler provided
      if (onAutoSave) {
        await onAutoSave();
      }

      // 2. Activate test mode
      const { error: updateError } = await supabase
        .from("conversations")
        .update({ is_test_mode: true, ai_mode: "autopilot" })
        .eq("id", conversationId);

      if (updateError) throw updateError;

      // 3. Invoke flow engine
      const { data, error } = await supabase.functions.invoke("process-chat-flow", {
        body: {
          conversationId,
          contactId,
          flowId,
          manualTrigger: true,
          bypassActiveCheck: true,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`🧪 Teste iniciado com fluxo "${flowName}"`);
      onClose();

      // 4. Redirect to inbox
      navigate(`/inbox?conversation=${conversationId}`);
    } catch (err) {
      console.error("[FlowTestDialog] Error:", err);
      toast.error("Erro ao iniciar teste do fluxo");
    } finally {
      setIsStarting(false);
    }
  };

  const getContactDisplay = (conv: any) => {
    const c = conv.contacts;
    if (!c) return "Sem contato";
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
    return name || c.phone || "Sem nome";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Testar Fluxo
          </DialogTitle>
          <DialogDescription>
            Selecione uma conversa para executar o fluxo "{flowName}" com o motor real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[280px] border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !conversations?.length ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p>Nenhuma conversa encontrada</p>
              </div>
            ) : (
              <div className="p-1 space-y-1">
                {conversations.map((conv: any) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedId(conv.id === selectedId ? null : conv.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-md transition-colors text-sm flex items-center justify-between ${
                      selectedId === conv.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getContactDisplay(conv)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.channel || "webchat"} · {conv.status}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                      {conv.channel || "web"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <Button
            className="w-full"
            disabled={!selectedId || isStarting}
            onClick={() => {
              const conv = conversations?.find((c: any) => c.id === selectedId);
              if (conv) handleStartTest(conv.id, conv.contact_id);
            }}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Iniciando teste...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Teste
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
