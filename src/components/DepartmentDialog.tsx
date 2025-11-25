import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateDepartment } from "@/hooks/useCreateDepartment";
import { useUpdateDepartment } from "@/hooks/useUpdateDepartment";
import type { Department } from "@/hooks/useDepartments";

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
}

export default function DepartmentDialog({ open, onOpenChange, department }: DepartmentDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();

  useEffect(() => {
    if (department) {
      setName(department.name);
      setDescription(department.description || "");
      setColor(department.color);
    } else {
      setName("");
      setDescription("");
      setColor("#3B82F6");
    }
  }, [department, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (department) {
      await updateMutation.mutateAsync({
        id: department.id,
        name,
        description,
        color,
      });
    } else {
      await createMutation.mutateAsync({
        name,
        description,
        color,
      });
    }

    onOpenChange(false);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
          <DialogDescription>
            {department ? "Atualize as informações do departamento." : "Adicione um novo departamento organizacional."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Customer Success"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva a função deste departamento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor de Identificação</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : department ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
