import { useState } from "react";
import { Workflow, MessageSquare, Loader2 } from "lucide-react";
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
import { useChatFlows } from "@/hooks/useChatFlows";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FlowPickerButtonProps {
  conversationId: string;
  contactId?: string;
  disabled?: boolean;
}

export function FlowPickerButton({ 
  conversationId, 
  contactId,
  disabled = false 
}: FlowPickerButtonProps) {
  const { data: flows, isLoading } = useChatFlows();
  const [isStarting, setIsStarting] = useState<string | null>(null);

  const activeFlows = flows?.filter(f => f.is_active) || [];

  const handleStartFlow = async (flowId: string, flowName: string) => {
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
        }
      });

      if (error) throw error;

      if (data?.flowStarted) {
        toast.success(`Fluxo "${flowName}" iniciado!`);
      } else if (data?.error) {
        toast.error(data.error);
      } else {
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

  if (activeFlows.length === 0) {
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
          <p>Nenhum fluxo ativo disponível</p>
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
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Iniciar Fluxo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {activeFlows.map((flow) => (
          <DropdownMenuItem 
            key={flow.id} 
            onClick={() => handleStartFlow(flow.id, flow.name)}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
