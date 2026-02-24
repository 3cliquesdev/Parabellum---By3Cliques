import { useState } from "react";
import { Workflow, MessageSquare, Loader2, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useChatFlows } from "@/hooks/useChatFlows";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FlowPickerButtonProps {
  conversationId: string;
  contactId?: string;
  disabled?: boolean;
  isTestMode?: boolean;
}

export function FlowPickerButton({ 
  conversationId, 
  contactId,
  disabled = false,
  isTestMode = false,
}: FlowPickerButtonProps) {
  const { data: flows, isLoading } = useChatFlows();
  const [isStarting, setIsStarting] = useState<string | null>(null);

  const activeFlows = flows?.filter(f => f.is_active) || [];
  const draftFlows = isTestMode ? (flows?.filter(f => !f.is_active) || []) : [];

  const handleStartFlow = async (flowId: string, flowName: string, isDraft: boolean) => {
    if (!conversationId) {
      toast.error("Nenhuma conversa selecionada");
      return;
    }

    setIsStarting(flowId);

    try {
      const { data, error } = await supabase.functions.invoke("process-chat-flow", {
        body: {
          conversationId,
          contactId,
          flowId,
          manualTrigger: true,
          ...(isDraft ? { bypassActiveCheck: true } : {}),
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
      } else if (data?.flowStarted || !data?.error) {
        toast.success(`Fluxo "${flowName}" iniciado!`);
      }
    } catch (error) {
      console.error("[FlowPickerButton] Error starting flow:", error);
      toast.error("Erro ao iniciar fluxo");
    } finally {
      setIsStarting(null);
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" disabled>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Button>
    );
  }

  const hasAnyFlows = activeFlows.length > 0 || draftFlows.length > 0;

  if (!hasAnyFlows) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 shrink-0" 
            disabled
          >
            <Workflow className="h-5 w-5 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isTestMode ? "Nenhum fluxo disponível (ativo ou rascunho)" : "Nenhum fluxo ativo disponível"}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 shrink-0"
              disabled={disabled}
            >
              <Workflow className="h-5 w-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Iniciar fluxo manual</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        {activeFlows.length > 0 && (
          <>
            <DropdownMenuLabel>
              {draftFlows.length > 0 ? "Ativos" : "Iniciar Fluxo"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {activeFlows.map((flow) => (
              <DropdownMenuItem 
                key={flow.id} 
                onClick={() => handleStartFlow(flow.id, flow.name, false)}
                disabled={isStarting === flow.id}
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
            <DropdownMenuLabel>🧪 Rascunhos (teste)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {draftFlows.map((flow) => (
              <DropdownMenuItem 
                key={flow.id} 
                onClick={() => handleStartFlow(flow.id, flow.name, true)}
                disabled={isStarting === flow.id}
                className="cursor-pointer"
              >
                {isStarting === flow.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FlaskConical className="h-4 w-4 mr-2 text-warning" />
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
