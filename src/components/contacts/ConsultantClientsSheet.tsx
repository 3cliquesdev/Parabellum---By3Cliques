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
import { useActiveConsultants } from "@/hooks/useConsultants";
import { useToast } from "@/hooks/use-toast";
import { Users, ArrowRight, Loader2 } from "lucide-react";

interface ConsultantClientsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultantId: string;
  consultantName: string;
}

export function ConsultantClientsSheet({
  open,
  onOpenChange,
  consultantId,
  consultantName,
}: ConsultantClientsSheetProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetConsultantId, setTargetConsultantId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const transferMutation = useMutation({
    mutationFn: async ({ contactIds, newConsultantId }: { contactIds: string[]; newConsultantId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update contacts
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ consultant_id: newConsultantId })
        .in("id", contactIds);

      if (updateError) throw updateError;

      // Log interactions for each contact
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
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["consultant-clients", consultantId] });
      toast({
        title: "Clientes transferidos",
        description: `${selectedIds.length} cliente(s) transferido(s) com sucesso`,
      });
      setSelectedIds([]);
      setTargetConsultantId("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao transferir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const handleTransfer = () => {
    if (selectedIds.length === 0 || !targetConsultantId) return;
    transferMutation.mutate({ contactIds: selectedIds, newConsultantId: targetConsultantId });
  };

  const allSelected = clients && clients.length > 0 && selectedIds.length === clients.length;

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

                  <Button
                    className="w-full gap-2"
                    onClick={handleTransfer}
                    disabled={!targetConsultantId || transferMutation.isPending}
                  >
                    {transferMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Transferir {selectedIds.length} cliente(s)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
