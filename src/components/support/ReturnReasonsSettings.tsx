import { useState } from "react";
import {
  useReturnReasons,
  useCreateReturnReason,
  useUpdateReturnReason,
  ReturnReason,
} from "@/hooks/useReturnReasons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";

export default function ReturnReasonsSettings() {
  const { data: reasons, isLoading } = useReturnReasons(true);
  const createReason = useCreateReturnReason();
  const updateReason = useUpdateReturnReason();

  const [showDialog, setShowDialog] = useState(false);
  const [editingReason, setEditingReason] = useState<ReturnReason | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formOrder, setFormOrder] = useState(0);

  const openCreate = () => {
    setEditingReason(null);
    setFormKey("");
    setFormLabel("");
    setFormOrder((reasons?.length || 0) + 1);
    setShowDialog(true);
  };

  const openEdit = (reason: ReturnReason) => {
    setEditingReason(reason);
    setFormKey(reason.key);
    setFormLabel(reason.label);
    setFormOrder(reason.sort_order);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formKey.trim() || !formLabel.trim()) return;
    if (editingReason) {
      await updateReason.mutateAsync({
        id: editingReason.id,
        key: formKey.trim(),
        label: formLabel.trim(),
        sort_order: formOrder,
      });
    } else {
      await createReason.mutateAsync({
        key: formKey.trim(),
        label: formLabel.trim(),
        sort_order: formOrder,
      });
    }
    setShowDialog(false);
  };

  const handleToggleActive = async (reason: ReturnReason) => {
    await updateReason.mutateAsync({
      id: reason.id,
      is_active: !reason.is_active,
    });
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Motivos de Devolução</h2>
          <p className="text-sm text-muted-foreground">Gerencie os motivos disponíveis para devoluções</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Motivo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {reasons?.map((reason) => (
            <div
              key={reason.id}
              className={`flex items-center justify-between p-4 rounded-lg border border-border bg-card transition-opacity ${!reason.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground">{reason.label}</p>
                <p className="text-sm text-muted-foreground font-mono mt-0.5">
                  {reason.key}
                  <span className="mx-2 text-border">·</span>
                  <span className="font-sans">Ordem: {reason.sort_order}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <Switch
                  checked={reason.is_active}
                  onCheckedChange={() => handleToggleActive(reason)}
                />
                <Button variant="ghost" size="sm" onClick={() => openEdit(reason)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {(!reasons || reasons.length === 0) && (
            <p className="text-center text-muted-foreground py-8">Nenhum motivo cadastrado</p>
          )}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingReason ? "Editar Motivo" : "Novo Motivo"}</DialogTitle>
            <DialogDescription>
              {editingReason ? "Atualize os dados do motivo" : "Cadastre um novo motivo de devolução"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chave (identificador único)</Label>
              <Input
                value={formKey}
                onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="ex: produto_danificado"
              />
            </div>
            <div className="space-y-2">
              <Label>Label (exibido ao usuário)</Label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="ex: Produto Danificado"
              />
            </div>
            <div className="space-y-2">
              <Label>Ordem de exibição</Label>
              <Input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!formKey.trim() || !formLabel.trim() || createReason.isPending || updateReason.isPending}
            >
              {(createReason.isPending || updateReason.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingReason ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
