import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FlaskConical, ChevronDown, Workflow, Play, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatFlows } from "@/hooks/useChatFlows";
import { useActiveFlowState } from "@/hooks/useActiveFlowState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestModeDropdownProps {
  isTestMode: boolean;
  toggleTestMode: (enabled: boolean) => void;
  isTestModePending: boolean;
  conversationId: string;
}

export function TestModeDropdown({
  isTestMode,
  toggleTestMode,
  isTestModePending,
  conversationId,
}: TestModeDropdownProps) {
  const { data: flows = [] } = useChatFlows();
  const { activeFlow } = useActiveFlowState(conversationId);
  const [isStarting, setIsStarting] = useState(false);

  const draftFlows = flows.filter((f) => !f.is_active);
  const activeFlows = flows.filter((f) => f.is_active);

  const handleStartFlow = async (flowId: string, isDraft: boolean) => {
    if (activeFlow) {
      toast.error("Já existe um fluxo em execução nesta conversa. Cancele-o antes de iniciar outro.");
      return;
    }

    setIsStarting(true);
    try {
      // Ativar test mode automaticamente se for rascunho e não estiver ativo
      if (isDraft && !isTestMode) {
        toggleTestMode(true);
        // Pequeno delay para garantir que o test mode foi salvo
        await new Promise((r) => setTimeout(r, 300));
      }

      const { error } = await supabase.functions.invoke("process-chat-flow", {
        body: {
          conversationId,
          flowId,
          manualTrigger: true,
          bypassActiveCheck: isDraft,
        },
      });

      if (error) throw error;
      toast.success("Fluxo iniciado com sucesso!");
    } catch (err: any) {
      console.error("[TestModeDropdown] Error starting flow:", err);
      toast.error(err?.message || "Erro ao iniciar fluxo");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isTestMode ? "default" : "outline"}
          size="sm"
          disabled={isTestModePending || isStarting}
          className={cn(
            "h-7 gap-1 px-2",
            isTestMode && "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
          )}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          <span className="text-xs hidden lg:inline">
            {isTestMode ? "Teste" : "Testar"}
          </span>
          <ChevronDown className="h-3 w-3 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 z-50 bg-popover">
        {/* Toggle do modo teste */}
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            toggleTestMode(!isTestMode);
          }}
          className="gap-2 cursor-pointer"
        >
          {isTestMode ? (
            <ToggleRight className="h-4 w-4 text-amber-500" />
          ) : (
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          )}
          <span>Modo Teste: {isTestMode ? "Ativo" : "Inativo"}</span>
        </DropdownMenuItem>

        {/* Rascunhos */}
        {draftFlows.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Rascunhos (teste)
            </DropdownMenuLabel>
            {draftFlows.map((flow) => (
              <DropdownMenuItem
                key={flow.id}
                onClick={() => handleStartFlow(flow.id, true)}
                disabled={!!activeFlow || isStarting}
                className="gap-2 cursor-pointer"
              >
                <Workflow className="h-3.5 w-3.5 text-amber-500" />
                <span className="truncate">{flow.name}</span>
                <Play className="h-3 w-3 ml-auto text-muted-foreground" />
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Ativos */}
        {activeFlows.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Ativos
            </DropdownMenuLabel>
            {activeFlows.map((flow) => (
              <DropdownMenuItem
                key={flow.id}
                onClick={() => handleStartFlow(flow.id, false)}
                disabled={!!activeFlow || isStarting}
                className="gap-2 cursor-pointer"
              >
                <Workflow className="h-3.5 w-3.5 text-green-500" />
                <span className="truncate">{flow.name}</span>
                <Play className="h-3 w-3 ml-auto text-muted-foreground" />
              </DropdownMenuItem>
            ))}
          </>
        )}

        {draftFlows.length === 0 && activeFlows.length === 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              Nenhum fluxo disponível
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
