import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FlaskConical, ToggleLeft, ToggleRight, Loader2, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useChatFlows } from "@/hooks/useChatFlows";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestModeDropdownProps {
  isTestMode: boolean;
  toggleTestMode: (enabled: boolean) => void;
  isTestModePending: boolean;
  conversationId: string;
  contactId?: string;
}

export function TestModeDropdown({
  isTestMode,
  toggleTestMode,
  isTestModePending,
  conversationId,
  contactId,
}: TestModeDropdownProps) {
  const { data: flows, isLoading: flowsLoading } = useChatFlows();
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState<string | null>(null);

  const activeFlows = flows?.filter(f => f.is_active) || [];
  const draftFlows = flows?.filter(f => !f.is_active) || [];

  // Ação atômica: ativa test mode + inicia fluxo escolhido
  const handleSelectFlow = async (flowId: string, flowName: string, isDraft: boolean) => {
    setIsStarting(flowId);
    try {
      // 1. Buscar metadata atual para limpar OTP residual
      const { data: convData } = await supabase
        .from("conversations")
        .select("customer_metadata")
        .eq("id", conversationId)
        .single();

      const existingMetadata = (convData?.customer_metadata as Record<string, unknown>) || {};
      const { awaiting_otp, otp_reason, otp_expires_at, claimant_email, ...cleanMetadata } = existingMetadata as Record<string, unknown>;

      // 2. Ativar test mode + limpar metadata residual de OTP
      const { error: updateError } = await supabase
        .from("conversations")
        .update({ 
          is_test_mode: true, 
          ai_mode: 'autopilot',
          status: 'open',
          customer_metadata: cleanMetadata as Record<string, string | number | boolean | null>,
        })
        .eq("id", conversationId);

      if (updateError) throw updateError;

      // 2. Iniciar fluxo escolhido
      const { data, error } = await supabase.functions.invoke("process-chat-flow", {
        body: {
          conversationId,
          contactId,
          flowId,
          manualTrigger: true,
          ...(isDraft ? { bypassActiveCheck: true } : {}),
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`🧪 Teste ativado com fluxo "${flowName}"`);
      }

      // Invalidar caches
      queryClient.invalidateQueries({ queryKey: ["test-mode", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["active-flow-state", conversationId] });
    } catch (err) {
      console.error("[TestModeDropdown] Error:", err);
      toast.error("Erro ao ativar modo de teste");
    } finally {
      setIsStarting(null);
    }
  };

  // Desativar test mode
  const handleDeactivate = () => {
    toggleTestMode(false);
  };

  // Se test mode está ATIVO: clique direto desativa
  if (isTestMode) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            disabled={isTestModePending}
            onClick={handleDeactivate}
            className={cn(
              "h-7 gap-1 px-2",
              "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
            )}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            <ToggleRight className="h-3.5 w-3.5" />
            <span className="text-xs hidden lg:inline">Teste</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Clique para desativar Modo Teste</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Se test mode está DESATIVADO: abre dropdown com fluxos
  const hasAnyFlows = activeFlows.length > 0 || draftFlows.length > 0;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isTestModePending || flowsLoading}
              className="h-7 gap-1 px-2"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <ToggleLeft className="h-3.5 w-3.5" />
              <span className="text-xs hidden lg:inline">Testar</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ativar Modo Teste (escolha o fluxo)</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>🧪 Escolha o fluxo de teste</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!hasAnyFlows && (
          <DropdownMenuItem disabled>
            <span className="text-xs text-muted-foreground">Nenhum fluxo disponível</span>
          </DropdownMenuItem>
        )}

        {activeFlows.length > 0 && (
          <>
            {draftFlows.length > 0 && (
              <DropdownMenuLabel className="text-xs text-muted-foreground">Ativos</DropdownMenuLabel>
            )}
            {activeFlows.map((flow) => (
              <DropdownMenuItem
                key={flow.id}
                onClick={() => handleSelectFlow(flow.id, flow.name, false)}
                disabled={!!isStarting}
                className="cursor-pointer"
              >
                {isStarting === flow.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                <span className="truncate">{flow.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {draftFlows.length > 0 && (
          <>
            {activeFlows.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">🧪 Rascunhos</DropdownMenuLabel>
            {draftFlows.map((flow) => (
              <DropdownMenuItem
                key={flow.id}
                onClick={() => handleSelectFlow(flow.id, flow.name, true)}
                disabled={!!isStarting}
                className="cursor-pointer"
              >
                {isStarting === flow.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4 mr-2 text-amber-500" />
                )}
                <span className="truncate flex-1">{flow.name}</span>
                <Badge variant="warning" className="ml-2 text-[10px] px-1.5 py-0">Rascunho</Badge>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
