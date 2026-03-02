import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useActiveConsultants } from "@/hooks/useConsultants";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { hasFullAccess } from "@/config/roles";
import { Users, ArrowRight, Loader2, Shuffle, UserMinus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConsultantClientsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultantId: string;
  consultantName: string;
}

type DistributionMode = "single" | "round_robin";

export function ConsultantClientsSheet({
  open,
  onOpenChange,
  consultantId,
  consultantName,
}: ConsultantClientsSheetProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetConsultantId, setTargetConsultantId] = useState<string>("");
  const [distributionMode, setDistributionMode] = useState<DistributionMode>("single");
  const [selectedConsultantIds, setSelectedConsultantIds] = useState<string[]>([]);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  const canUnlink = hasFullAccess(role);

  const { data: consultants } = useActiveConsultants();
  const availableConsultants = consultants?.filter(c => c.id !== consultantId) || [];

  const { data: clients, isLoading } = useQuery({
    queryKey: ["consultant-clients", consultantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, status")
        .eq("consultant_id", consultantId)
        .order("first_name");

      if (error) throw error;
      return data;
    },
    enabled: open && !!consultantId,
  });

  // Single transfer mutation
  const transferMutation = useMutation({
    mutationFn: async ({ contactIds, newConsultantId }: { contactIds: string[]; newConsultantId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ consultant_id: newConsultantId })
        .in("id", contactIds);

      if (updateError) throw updateError;

      const interactions = contactIds.map(contactId => ({
        customer_id: contactId,
        type: "conversation_transferred" as const,
        channel: "other" as const,
        content: `Consultor alterado de ${consultantName} para novo consultor via transferência em massa`,
        created_by: user?.id,
      }));

      const { error: interactionError } = await supabase
        .from("interactions")
        .insert(interactions);

      if (interactionError) throw interactionError;
    },
    onSuccess: () => {
      handleTransferSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao transferir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Round-robin distribution mutation
  const roundRobinMutation = useMutation({
    mutationFn: async ({ contactIds, consultantIds }: { contactIds: string[]; consultantIds: string[] }) => {
      const { data, error } = await supabase.rpc('distribute_clients_round_robin', {
        p_contact_ids: contactIds,
        p_consultant_ids: consultantIds,
        p_source_consultant_name: consultantName,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; distributed: number };
      if (!result.success) {
        throw new Error(result.error || 'Erro na distribuição');
      }
      
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: "Clientes distribuídos",
        description: `${result.distributed} cliente(s) distribuído(s) em round-robin entre ${selectedConsultantIds.length} consultor(es)`,
      });
      handleTransferSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao distribuir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unlink mutation - remove consultant_id
  const unlinkMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Setar consultant_id = null e flag de remoção manual
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ consultant_id: null, consultant_manually_removed: true } as any)
        .in("id", contactIds);

      if (updateError) throw updateError;

      // 2. Resetar conversas abertas para autopilot (libera Master Flow)
      const { data: openConvos } = await supabase
        .from("conversations")
        .select("id")
        .in("contact_id", contactIds)
        .in("status", ["open"])
        .in("ai_mode", ["waiting_human", "copilot"]);

      if (openConvos && openConvos.length > 0) {
        const convIds = openConvos.map(c => c.id);
        await supabase
          .from("conversations")
          .update({ ai_mode: "autopilot" as any, assigned_to: null })
          .in("id", convIds);
        console.log("[ConsultantClientsSheet] Reset ai_mode→autopilot para", convIds.length, "conversas");
      }

      const interactions = contactIds.map(contactId => ({
        customer_id: contactId,
        type: "note" as const,
        channel: "other" as const,
        content: `Consultor ${consultantName} removido do cliente por admin/gerente`,
        created_by: user?.id,
        metadata: {
          action: "consultant_removed",
          old_consultant_id: consultantId,
          removed_by: user?.id,
        },
      }));

      const { error: interactionError } = await supabase
        .from("interactions")
        .insert(interactions);

      if (interactionError) throw interactionError;
    },
    onSuccess: () => {
      toast({
        title: "Clientes desvinculados",
        description: `${selectedIds.length} cliente(s) removido(s) do consultor ${consultantName}`,
      });
      handleTransferSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desvincular",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTransferSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["consultant-clients", consultantId] });
    setSelectedIds([]);
    setTargetConsultantId("");
    setSelectedConsultantIds([]);
    setDistributionMode("single");
    setShowUnlinkDialog(false);
    onOpenChange(false);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && clients) {
      setSelectedIds(clients.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleConsultantToggle = (consultantId: string, checked: boolean) => {
    if (checked) {
      setSelectedConsultantIds([...selectedConsultantIds, consultantId]);
    } else {
      setSelectedConsultantIds(selectedConsultantIds.filter(id => id !== consultantId));
    }
  };

  const handleTransfer = () => {
    if (selectedIds.length === 0) return;

    if (distributionMode === "single") {
      if (!targetConsultantId) return;
      transferMutation.mutate({ contactIds: selectedIds, newConsultantId: targetConsultantId });
    } else {
      if (selectedConsultantIds.length < 2) {
        toast({
          title: "Selecione pelo menos 2 consultores",
          description: "Round-robin requer no mínimo 2 consultores para distribuição",
          variant: "destructive",
        });
        return;
      }
      roundRobinMutation.mutate({ contactIds: selectedIds, consultantIds: selectedConsultantIds });
    }
  };

  const allSelected = clients && clients.length > 0 && selectedIds.length === clients.length;
  const isPending = transferMutation.isPending || roundRobinMutation.isPending || unlinkMutation.isPending;
  
  const canTransfer = distributionMode === "single" 
    ? !!targetConsultantId 
    : selectedConsultantIds.length >= 2;

  // Calculate distribution preview
  const distributionPreview = useMemo(() => {
    if (distributionMode !== "round_robin" || selectedConsultantIds.length < 2 || selectedIds.length === 0) {
      return null;
    }
    
    const perConsultant = Math.floor(selectedIds.length / selectedConsultantIds.length);
    const remainder = selectedIds.length % selectedConsultantIds.length;
    
    return availableConsultants
      .filter(c => selectedConsultantIds.includes(c.id))
      .map((consultant, index) => ({
        name: consultant.full_name,
        count: perConsultant + (index < remainder ? 1 : 0),
      }));
  }, [distributionMode, selectedConsultantIds, selectedIds.length, availableConsultants]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes de {consultantName}
          </SheetTitle>
          <SheetDescription>
            Selecione os clientes que deseja transferir para outro consultor
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col h-[calc(100vh-200px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !clients || clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cliente atribuído a este consultor
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center gap-3 pb-4 border-b">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Selecionar todos ({clients.length})
                </span>
              </div>

              {/* Client List */}
              <ScrollArea className="flex-1 py-4">
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        selectedIds.includes(client.id)
                          ? "bg-primary/5 border-primary/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={selectedIds.includes(client.id)}
                        onCheckedChange={(checked) => handleSelectOne(client.id, checked as boolean)}
                      />
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {client.first_name[0]}{client.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {client.first_name} {client.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.email || client.phone || "Sem contato"}
                        </p>
                      </div>
                      {client.status && (
                        <Badge variant="outline" className="text-xs">
                          {client.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Transfer Section */}
              {selectedIds.length > 0 && (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {selectedIds.length} selecionado(s)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIds([])}
                    >
                      Limpar
                    </Button>
                  </div>

                  {/* Distribution Mode */}
                  <RadioGroup 
                    value={distributionMode} 
                    onValueChange={(value) => setDistributionMode(value as DistributionMode)}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="single" id="single" />
                      <Label htmlFor="single" className="cursor-pointer">
                        Um consultor específico
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="round_robin" id="round_robin" />
                      <Label htmlFor="round_robin" className="cursor-pointer flex items-center gap-2">
                        <Shuffle className="h-4 w-4" />
                        Distribuir em Round-Robin
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Single Consultant Select */}
                  {distributionMode === "single" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Transferir para:</label>
                      <Select value={targetConsultantId} onValueChange={setTargetConsultantId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o consultor" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableConsultants.map((consultant) => (
                            <SelectItem key={consultant.id} value={consultant.id}>
                              {consultant.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Round-Robin Consultant Selection */}
                  {distributionMode === "round_robin" && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        Selecione os consultores (mín. 2):
                      </label>
                      <ScrollArea className="max-h-32">
                        <div className="space-y-2">
                          {availableConsultants.map((consultant) => (
                            <div
                              key={consultant.id}
                              className={`flex items-center gap-3 p-2 rounded-md border transition-colors ${
                                selectedConsultantIds.includes(consultant.id)
                                  ? "bg-primary/5 border-primary/20"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <Checkbox
                                checked={selectedConsultantIds.includes(consultant.id)}
                                onCheckedChange={(checked) => 
                                  handleConsultantToggle(consultant.id, checked as boolean)
                                }
                              />
                              <span className="text-sm">{consultant.full_name}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      {/* Distribution Preview */}
                      {distributionPreview && (
                        <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Prévia da distribuição:
                          </p>
                          {distributionPreview.map((item) => (
                            <div key={item.name} className="flex justify-between text-sm">
                              <span>{item.name}</span>
                              <Badge variant="secondary">{item.count} cliente(s)</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {canUnlink && (
                      <Button
                        variant="destructive"
                        className="gap-2"
                        onClick={() => setShowUnlinkDialog(true)}
                        disabled={isPending}
                      >
                        <UserMinus className="h-4 w-4" />
                        Desvincular
                      </Button>
                    )}
                    <Button
                      className="flex-1 gap-2"
                      onClick={handleTransfer}
                      disabled={!canTransfer || isPending}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : distributionMode === "round_robin" ? (
                        <Shuffle className="h-4 w-4" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      {distributionMode === "round_robin" 
                        ? `Distribuir ${selectedIds.length} cliente(s)`
                        : `Transferir ${selectedIds.length} cliente(s)`
                      }
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular clientes do consultor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {selectedIds.length} cliente(s) do consultor{" "}
              <strong>{consultantName}</strong>? Os clientes ficarão sem consultor atribuído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => unlinkMutation.mutate(selectedIds)}
            >
              {unlinkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserMinus className="h-4 w-4 mr-2" />
              )}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
