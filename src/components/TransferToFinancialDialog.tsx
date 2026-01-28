import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTicketTransfer } from "@/hooks/useTicketTransfer";
import { useDepartments } from "@/hooks/useDepartments";
import { useUsersByDepartment } from "@/hooks/useUsersByDepartment";
import { ArrowRight, AlertCircle, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TransferToFinancialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  hasEvidence: boolean;
}

export function TransferToFinancialDialog({
  open,
  onOpenChange,
  ticketId,
  hasEvidence,
}: TransferToFinancialDialogProps) {
  const [internalNote, setInternalNote] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { mutate: transferTicket, isPending } = useTicketTransfer();
  const { data: departments = [] } = useDepartments();

  const financialDept = departments.find(d => d.name === 'Financeiro');
  const { data: financialUsers = [], isLoading: isLoadingUsers } = useUsersByDepartment(financialDept?.id);

  const handleTransfer = () => {
    if (!financialDept) {
      return;
    }

    transferTicket(
      {
        ticket_id: ticketId,
        department_id: financialDept.id,
        internal_note: internalNote || "Ticket enviado para análise financeira.",
        assigned_to: selectedUserId || null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setInternalNote("");
          setSelectedUserId("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-yellow-600" />
            Enviar para o Financeiro
          </DialogTitle>
          <DialogDescription>
            Este ticket será transferido para o departamento financeiro para análise e aprovação do reembolso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning se não tem evidências */}
          {!hasEvidence && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Este ticket não possui evidências anexadas. 
                É recomendado adicionar pelo menos 1 anexo antes de enviar ao Financeiro.
              </AlertDescription>
            </Alert>
          )}

          {/* Atribuir para usuário */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Atribuir para
            </Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingUsers ? "Carregando..." : "Selecione um responsável (opcional)"} />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                {financialUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} {user.job_title ? `(${user.job_title})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se não selecionar, o ticket ficará disponível para qualquer membro do Financeiro
            </p>
          </div>

          {/* Internal Note */}
          <div className="space-y-2">
            <Label htmlFor="internal-note">
              Nota Interna (Opcional)
            </Label>
            <Textarea
              id="internal-note"
              placeholder="Observações para o time financeiro (ex: Cliente VIP, urgente, revisar valores...)"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Esta nota será visível apenas para a equipe interna
            </p>
          </div>

          {/* Info card */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="text-sm font-semibold mb-2">O que acontecerá:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✓ Ticket será movido para o departamento Financeiro</li>
              <li>✓ Status mudará para "Em Progresso"</li>
              <li>✓ Sua nota interna será registrada</li>
              <li>✓ Um gestor financeiro analisará e decidirá</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isPending || !financialDept}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            {isPending ? "Transferindo..." : "Confirmar Transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
