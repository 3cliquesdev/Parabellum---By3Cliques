import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSupportAgents } from "@/hooks/useSupportAgents";
import { useDepartments } from "@/hooks/useDepartments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, Users, Bot, User, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface InboxBulkDistributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationIds: string[];
  onSuccess?: () => void;
}

type DestinationType = "agent" | "pool" | "auto" | "department";

export function InboxBulkDistributeDialog({
  open,
  onOpenChange,
  conversationIds,
  onSuccess,
}: InboxBulkDistributeDialogProps) {
  const [destinationType, setDestinationType] = useState<DestinationType>("auto");
  const [targetAgentId, setTargetAgentId] = useState<string>("");
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: agents } = useSupportAgents();
  const { data: departments } = useDepartments();

  // Filtrar agentes online
  const availableAgents = useMemo(() => {
    return (agents || []).filter(a => a.availability_status === "online");
  }, [agents]);

  const handleSubmit = async () => {
    if (conversationIds.length === 0) {
      toast.error("Nenhuma conversa selecionada");
      return;
    }

    if (destinationType === "agent" && !targetAgentId) {
      toast.error("Selecione um agente de destino");
      return;
    }

    if (destinationType === "department" && !targetDepartmentId) {
      toast.error("Selecione um departamento de destino");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("bulk-redistribute", {
        body: {
          conversationIds,
          destinationType,
          targetAgentId: destinationType === "agent" ? targetAgentId : null,
          targetDepartmentId: destinationType === "department" ? targetDepartmentId : null,
          sendCsat: false,
          sourceAgentId: null, // Não tem agente de origem pois estamos distribuindo do pool
        },
      });

      if (error) throw error;

      toast.success(`${data.successCount} conversas distribuídas com sucesso`);
      
      if (data.errorCount > 0) {
        toast.warning(`${data.errorCount} conversas não puderam ser distribuídas`);
      }

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ["inbox-view"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao distribuir:", error);
      toast.error("Erro ao distribuir conversas");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Distribuir Conversas
          </DialogTitle>
          <DialogDescription>
            Distribuir <strong>{conversationIds.length}</strong> conversa{conversationIds.length > 1 ? "s" : ""} selecionada{conversationIds.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        {/* Tipo de destino */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Destino</Label>
          <RadioGroup
            value={destinationType}
            onValueChange={(v) => setDestinationType(v as DestinationType)}
            className="space-y-2"
          >
            <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="auto" />
              <Users className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Distribuir automaticamente</p>
                <p className="text-xs text-muted-foreground">
                  Divide entre {availableAgents.length} agentes online
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="pool" />
              <Bot className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Pool geral (IA assume)</p>
                <p className="text-xs text-muted-foreground">
                  Conversas ficam não atribuídas, IA responde
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="agent" />
              <User className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Agente específico</p>
                <p className="text-xs text-muted-foreground">
                  Transfere para um agente selecionado
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="department" />
              <Building2 className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Departamento específico</p>
                <p className="text-xs text-muted-foreground">
                  Distribui entre agentes online do departamento
                </p>
              </div>
            </label>
          </RadioGroup>

          {destinationType === "department" && (
            <Select value={targetDepartmentId} onValueChange={setTargetDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento..." />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                {departments?.filter(d => d.is_active).map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: dept.color || '#6B7280' }}
                      />
                      <span>{dept.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {destinationType === "agent" && (
            <Select value={targetAgentId} onValueChange={setTargetAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o agente..." />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                {availableAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={agent.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {agent.full_name?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span>{agent.full_name}</span>
                    </div>
                  </SelectItem>
                ))}
                {availableAgents.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum agente online disponível
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Distribuindo...
              </>
            ) : (
              <>Distribuir {conversationIds.length} conversa{conversationIds.length !== 1 ? "s" : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
