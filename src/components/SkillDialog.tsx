import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSkill } from "@/hooks/useCreateSkill";
import { useUpdateSkill } from "@/hooks/useUpdateSkill";
import { Skill } from "@/hooks/useSkills";

interface SkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSkill?: Skill | null;
}

export default function SkillDialog({ open, onOpenChange, editSkill }: SkillDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");

  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();

  const isEditMode = !!editSkill;

  useEffect(() => {
    if (editSkill) {
      setName(editSkill.name);
      setDescription(editSkill.description || "");
      setColor(editSkill.color);
    } else {
      setName("");
      setDescription("");
      setColor("#3B82F6");
    }
  }, [editSkill, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode && editSkill) {
      await updateSkill.mutateAsync({
        id: editSkill.id,
        name,
        description,
        color,
      });
    } else {
      await createSkill.mutateAsync({
        name,
        description,
        color,
      });
    }

    onOpenChange(false);
  };

  const loading = createSkill.isPending || updateSkill.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Editar Habilidade" : "Nova Habilidade"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Atualize as informações da habilidade"
              : "Crie uma nova habilidade para atribuir aos agentes"
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Habilidade *</Label>
              <Input
                id="name"
                placeholder="Ex: Financeiro, Inglês, Suporte Técnico"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva quando esta habilidade deve ser utilizada..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor do Badge</Label>
              <div className="flex gap-3 items-center">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-20 h-10 cursor-pointer"
                />
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Preview:</span>
                  <div
                    className="px-3 py-1 rounded-md text-white text-sm font-medium"
                    style={{ backgroundColor: color }}
                  >
                    {name || "Habilidade"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : (isEditMode ? "Salvar" : "Criar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
