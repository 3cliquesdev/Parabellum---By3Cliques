import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, User } from "lucide-react";
import { useDepartments } from "@/hooks/useDepartments";
import { useBulkTransferTickets } from "@/hooks/useBulkTransferTickets";
import { useUsersByDepartment } from "@/hooks/useUsersByDepartment";

interface BulkTransferTicketsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTicketIds: string[];
  onSuccess: () => void;
}

export function BulkTransferTicketsDialog({
  open,
  onOpenChange,
  selectedTicketIds,
  onSuccess,
}: BulkTransferTicketsDialogProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [internalNote, setInternalNote] = useState<string>("");

  const { data: departments = [], isLoading: departmentsLoading } = useDepartments();
  const { data: departmentUsers = [], isLoading: usersLoading } = useUsersByDepartment(selectedDepartmentId);
  const transferTickets = useBulkTransferTickets();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDepartmentId("");
      setSelectedUserId("");
      setInternalNote("");
    }
  }, [open]);

  // Reset user selection when department changes
  useEffect(() => {
    setSelectedUserId("");
  }, [selectedDepartmentId]);

  const handleTransfer = () => {
    if (!selectedDepartmentId) return;

    transferTickets.mutate(
      {
        ticketIds: selectedTicketIds,
        departmentId: selectedDepartmentId,
        assignedTo: selectedUserId || undefined,
        internalNote: internalNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          onSuccess();
          onOpenChange(false);
        },
      }
    );
  };

  const canSubmit = selectedDepartmentId && !transferTickets.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Tickets</DialogTitle>
        </DialogHeader>

        {departmentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-sm text-foreground">
                <strong>{selectedTicketIds.length}</strong> ticket
                {selectedTicketIds.length > 1 ? "s" : ""} será
                {selectedTicketIds.length > 1 ? "ão" : ""} transferido
                {selectedTicketIds.length > 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Departamento de destino</Label>
              <Select
                value={selectedDepartmentId}
                onValueChange={setSelectedDepartmentId}
              >
              <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start"
                  sideOffset={4}
                  className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                >
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDepartmentId && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Atribuir a (opcional)
                </Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={usersLoading ? "Carregando..." : "Nenhum (fila do departamento)"} />
                  </SelectTrigger>
                  <SelectContent 
                    position="popper" 
                    side="bottom" 
                    align="start"
                    sideOffset={4}
                    className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                  >
                    <SelectItem value="none">
                      Nenhum (fila do departamento)
                    </SelectItem>
                    {departmentUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se não selecionar ninguém, os tickets irão para a fila geral do departamento
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nota interna (opcional)</Label>
              <Textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Adicione uma nota que será adicionada a todos os tickets..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={!canSubmit}>
            {transferTickets.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Transferir {selectedTicketIds.length} ticket
            {selectedTicketIds.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
