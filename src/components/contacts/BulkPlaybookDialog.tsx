import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Play, Users } from "lucide-react";
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { useBulkTriggerPlaybook } from "@/hooks/useBulkTriggerPlaybook";

interface BulkPlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContactIds: string[];
  onSuccess?: () => void;
}

export function BulkPlaybookDialog({
  open,
  onOpenChange,
  selectedContactIds,
  onSuccess,
}: BulkPlaybookDialogProps) {
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>("");
  const [skipExisting, setSkipExisting] = useState(true);

  const { data: playbooks = [], isLoading } = usePlaybooks();
  const bulkTrigger = useBulkTriggerPlaybook();

  const activePlaybooks = playbooks.filter(p => p.is_active);

  const handleTrigger = () => {
    if (!selectedPlaybookId) return;

    bulkTrigger.mutate(
      {
        contactIds: selectedContactIds,
        playbookId: selectedPlaybookId,
        skipExisting,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedPlaybookId("");
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Iniciar Playbook em Massa
          </DialogTitle>
          <DialogDescription>
            Qual playbook você quer rodar para os{" "}
            <span className="font-semibold text-foreground">
              {selectedContactIds.length} clientes
            </span>{" "}
            selecionados?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Selecione o Playbook</Label>
            <Select
              value={selectedPlaybookId}
              onValueChange={setSelectedPlaybookId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha um playbook..." />
              </SelectTrigger>
              <SelectContent>
                {activePlaybooks.map(playbook => (
                  <SelectItem key={playbook.id} value={playbook.id}>
                    {playbook.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="skipExisting"
              checked={skipExisting}
              onCheckedChange={(checked) => setSkipExisting(checked as boolean)}
            />
            <Label htmlFor="skipExisting" className="text-sm">
              Ignorar clientes que já passaram por este playbook
            </Label>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">Atenção</p>
                <p className="text-muted-foreground">
                  Esta ação não pode ser desfeita. Os clientes receberão emails,
                  WhatsApp e outras ações configuradas no playbook.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleTrigger}
            disabled={!selectedPlaybookId || bulkTrigger.isPending}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {bulkTrigger.isPending ? "Disparando..." : "Disparar Agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
