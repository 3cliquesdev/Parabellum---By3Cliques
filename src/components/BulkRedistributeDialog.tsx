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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useAgentConversationsList } from "@/hooks/useAgentConversations";
import { useSupportAgents } from "@/hooks/useSupportAgents";
import { useDepartments } from "@/hooks/useDepartments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, Users, Bot, User, Building2 } from "lucide-react";
import { differenceInHours, differenceInMinutes } from "date-fns";

interface BulkRedistributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
}

type DestinationType = "agent" | "pool" | "auto" | "department";

function getSLAIndicator(lastMessageAt: string) {
  const hours = differenceInHours(new Date(), new Date(lastMessageAt));
  
  if (hours >= 4) return { color: "bg-red-500", label: "Crítico" };
  if (hours >= 2) return { color: "bg-orange-500", label: "Urgente" };
  if (hours >= 1) return { color: "bg-yellow-500", label: "Alerta" };
  return { color: "bg-green-500", label: "Normal" };
}

function formatWaitTime(lastMessageAt: string) {
  const minutes = differenceInMinutes(new Date(), new Date(lastMessageAt));
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function BulkRedistributeDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
}: BulkRedistributeDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [destinationType, setDestinationType] = useState<DestinationType>("auto");
  const [targetAgentId, setTargetAgentId] = useState<string>("");
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>("");
  const [sendCsat, setSendCsat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: conversations, isLoading } = useAgentConversationsList(agentId);
  const { data: agents } = useSupportAgents();
  const { data: departments } = useDepartments();

  // Filtrar agentes online (exceto o atual)
  const availableAgents = useMemo(() => {
    return (agents || []).filter(a => 
      a.id !== agentId && 
      a.availability_status === "online"
    );
  }, [agents, agentId]);

  const handleSelectAll = () => {
    if (selectedIds.size === (conversations?.length || 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations?.map(c => c.id) || []));
    }
  };

  const toggleConversation = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos uma conversa");
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
          conversationIds: Array.from(selectedIds),
          destinationType,
          targetAgentId: destinationType === "agent" ? targetAgentId : null,
          targetDepartmentId: destinationType === "department" ? targetDepartmentId : null,
          sendCsat,
          sourceAgentId: agentId,
        },
      });

      if (error) throw error;

      toast.success(`${data.successCount} conversas redistribuídas com sucesso`);
      
      if (data.errorCount > 0) {
        toast.warning(`${data.errorCount} conversas não puderam ser redistribuídas`);
      }

      onOpenChange(false);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Erro ao redistribuir:", error);
      toast.error("Erro ao redistribuir conversas");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Redistribuir Conversas
          </DialogTitle>
          <DialogDescription>
            Redistribuir conversas de <strong>{agentName}</strong> para outro destino.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !conversations?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            Este agente não possui conversas ativas.
          </div>
        ) : (
          <>
            {/* Lista de conversas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Conversas ({conversations.length})
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {selectedIds.size === conversations.length ? "Desmarcar todas" : "Selecionar todas"}
                </Button>
              </div>

              <ScrollArea className="h-48 rounded-md border">
                <div className="p-2 space-y-1">
                  {conversations.map((conv) => {
                    const sla = getSLAIndicator(conv.last_message_at);
                    const contact = conv.contacts;
                    
                    return (
                      <label
                        key={conv.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedIds.has(conv.id)}
                          onCheckedChange={() => toggleConversation(conv.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {contact?.first_name} {contact?.last_name}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${sla.color}`} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {contact?.phone || contact?.email || "Sem contato"} • {formatWaitTime(conv.last_message_at)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

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

            {/* Opção de CSAT */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Enviar pesquisa CSAT</p>
                <p className="text-xs text-muted-foreground">
                  Envia avaliação por WhatsApp antes de redistribuir
                </p>
              </div>
              <Switch checked={sendCsat} onCheckedChange={setSendCsat} />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || selectedIds.size === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Redistribuindo...
              </>
            ) : (
              <>Redistribuir {selectedIds.size} conversa{selectedIds.size !== 1 ? "s" : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
