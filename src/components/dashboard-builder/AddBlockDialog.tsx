import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReportDefinitions, useAddBlock } from "@/hooks/useDashboards";

interface AddBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  currentBlockCount: number;
}

export function AddBlockDialog({ open, onOpenChange, dashboardId, currentBlockCount }: AddBlockDialogProps) {
  const { data: reports, isLoading } = useReportDefinitions();
  const addBlock = useAddBlock();

  const [reportId, setReportId] = useState("");
  const [vizType, setVizType] = useState<string>("table");
  const [title, setTitle] = useState("");

  const handleSave = () => {
    if (!reportId) return;
    addBlock.mutate(
      {
        dashboard_id: dashboardId,
        report_id: reportId,
        visualization_type: vizType,
        title: title.trim() || undefined,
        sort_order: currentBlockCount,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setReportId("");
          setVizType("table");
          setTitle("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Adicionar Bloco</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Relatório</Label>
            <Select value={reportId} onValueChange={setReportId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione um relatório"} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {reports?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Visualização</Label>
            <Select value={vizType} onValueChange={setVizType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="table">Tabela</SelectItem>
                <SelectItem value="card">Card (KPI)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título (opcional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Total de Vendas" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!reportId || addBlock.isPending}>
            {addBlock.isPending ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
