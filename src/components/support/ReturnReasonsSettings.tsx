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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Chave</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-center w-[80px]">Ordem</TableHead>
                <TableHead className="text-center w-[80px]">Ativo</TableHead>
                <TableHead className="text-right w-[70px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reasons?.map((reason) => (
                <TableRow key={reason.id} className={!reason.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    <span className="inline-block font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
                      {reason.key}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{reason.label}</TableCell>
                  <TableCell className="text-center">{reason.sort_order}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={reason.is_active}
                      onCheckedChange={() => handleToggleActive(reason)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(reason)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                disabled={!!editingReason}
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
