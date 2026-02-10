import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTicketOrigin, useUpdateTicketOrigin, type TicketOrigin } from "@/hooks/useTicketOrigins";

interface OriginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin?: TicketOrigin | null;
}

export default function OriginDialog({ open, onOpenChange, origin }: OriginDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6B7280");

  const createMutation = useCreateTicketOrigin();
  const updateMutation = useUpdateTicketOrigin();

  useEffect(() => {
    if (origin) {
      setName(origin.name);
      setDescription(origin.description || "");
      setColor(origin.color);
    } else {
      setName("");
      setDescription("");
      setColor("#6B7280");
    }
  }, [origin, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (origin) {
      await updateMutation.mutateAsync({ id: origin.id, name, description, color });
    } else {
      await createMutation.mutateAsync({ name, description, color });
    }
    onOpenChange(false);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{origin ? "Editar Origem" : "Nova Origem"}</DialogTitle>
          <DialogDescription>
            {origin ? "Atualize as informações da origem." : "Adicione uma nova origem para tickets (etapa da jornada do cliente)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="origin-name">Nome *</Label>
              <Input id="origin-name" placeholder="Ex: Antes do pagamento" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="origin-desc">Descrição</Label>
              <Textarea id="origin-desc" placeholder="Descreva esta origem..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="origin-color">Cor</Label>
              <div className="flex gap-2">
                <Input id="origin-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-20 h-10" />
                <Input type="text" value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : origin ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
