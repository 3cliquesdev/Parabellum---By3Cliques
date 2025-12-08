import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useActiveConsultants } from "@/hooks/useConsultants";
import { UserCog, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ChangeConsultantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  currentConsultantId?: string | null;
}

export function ChangeConsultantDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  currentConsultantId,
}: ChangeConsultantDialogProps) {
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>(
    currentConsultantId || ""
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: consultants, isLoading: loadingConsultants } = useActiveConsultants();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (newConsultantId: string) => {
      // Update contact's consultant_id
      const { error: contactError } = await supabase
        .from("contacts")
        .update({ consultant_id: newConsultantId })
        .eq("id", contactId);

      if (contactError) throw contactError;

      // Log the change as an interaction
      const newConsultant = consultants?.find((c) => c.id === newConsultantId);
      const oldConsultant = consultants?.find((c) => c.id === currentConsultantId);

      await supabase.from("interactions").insert({
        customer_id: contactId,
        type: "note",
        content: `Consultor alterado de "${oldConsultant?.full_name || "Não atribuído"}" para "${newConsultant?.full_name || "Não atribuído"}"`,
        channel: "other",
        created_by: user?.id,
        metadata: {
          action: "consultant_change",
          old_consultant_id: currentConsultantId,
          new_consultant_id: newConsultantId,
          changed_by: user?.id,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Consultor alterado",
        description: "O consultor do cliente foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["playbook-executions"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-clients"] });
      queryClient.invalidateQueries({ queryKey: ["manager-portfolio-clients"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar consultor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedConsultantId) return;
    mutation.mutate(selectedConsultantId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Alterar Consultor
          </DialogTitle>
          <DialogDescription>
            Selecione o novo consultor responsável por <strong>{contactName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Consultor</Label>
            <Select
              value={selectedConsultantId}
              onValueChange={setSelectedConsultantId}
              disabled={loadingConsultants}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um consultor" />
              </SelectTrigger>
              <SelectContent>
                {consultants?.map((consultant) => (
                  <SelectItem key={consultant.id} value={consultant.id}>
                    {consultant.full_name}
                    {consultant.id === currentConsultantId && " (atual)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedConsultantId ||
              selectedConsultantId === currentConsultantId ||
              mutation.isPending
            }
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserCog className="h-4 w-4 mr-2" />
            )}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
