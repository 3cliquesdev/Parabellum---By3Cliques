import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/tags/ColorPicker";
import {
  useCreateTicketCategory,
  useUpdateTicketCategory,
  TicketCategory,
} from "@/hooks/useTicketCategories";

interface TicketCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: TicketCategory | null;
}

export function TicketCategoryDialog({ open, onOpenChange, category }: TicketCategoryDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [isActive, setIsActive] = useState(true);

  const createCategory = useCreateTicketCategory();
  const updateCategory = useUpdateTicketCategory();

  const isEditing = !!category;

  useEffect(() => {
    if (category) {
      setName(category.name);
      setColor(category.color || "#3B82F6");
      setDescription(category.description || "");
      setPriority(category.priority || "medium");
      setIsActive(category.is_active);
    } else {
      setName("");
      setColor("#3B82F6");
      setDescription("");
      setPriority("medium");
      setIsActive(true);
    }
  }, [category, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = { name, color, description, priority, is_active: isActive };

    if (isEditing && category) {
      await updateCategory.mutateAsync({ id: category.id, ...data });
    } else {
      await createCategory.mutateAsync(data);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Categoria" : "Nova Categoria"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome da Categoria *</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Financeiro, Técnico, Devolução"
              required
            />
          </div>

          <ColorPicker value={color} onChange={setColor} />

          <div className="space-y-2">
            <Label>Prioridade Padrão</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cat-description">Descrição (opcional)</Label>
            <Textarea
              id="cat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva quando usar esta categoria"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="cat-active">Categoria ativa</Label>
            <Switch
              id="cat-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!name || createCategory.isPending || updateCategory.isPending}
            >
              {isEditing ? "Salvar" : "Criar Categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
