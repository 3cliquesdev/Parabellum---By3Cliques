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
import { ColorPicker } from "./ColorPicker";
import { useCreateTag, useUpdateTag } from "@/hooks/useTags";

interface Tag {
  id: string;
  name: string;
  color: string | null;
  category: string | null;
  description: string | null;
}

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
}

const TAG_CATEGORIES = [
  { value: "customer", label: "Tags de Cliente" },
  { value: "conversation", label: "Tags de Conversa" },
  { value: "ticket", label: "Tags de Ticket" },
  { value: "segmento", label: "Segmentação" },
  { value: "fonte", label: "Fonte de Lead" },
  { value: "status", label: "Status" },
];

export function TagDialog({ open, onOpenChange, tag }: TagDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [category, setCategory] = useState("customer");
  const [description, setDescription] = useState("");

  const createTag = useCreateTag();
  const updateTag = useUpdateTag();

  const isEditing = !!tag;

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color || "#3B82F6");
      setCategory(tag.category || "customer");
      setDescription(tag.description || "");
    } else {
      setName("");
      setColor("#3B82F6");
      setCategory("customer");
      setDescription("");
    }
  }, [tag, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = { name, color, category, description };

    if (isEditing && tag) {
      await updateTag.mutateAsync({ id: tag.id, ...data });
    } else {
      await createTag.mutateAsync(data);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Tag" : "Nova Tag"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Tag *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Urgente, VIP, Financeiro"
              required
            />
          </div>

          <ColorPicker value={color} onChange={setColor} />

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {TAG_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A categoria é apenas para organização. Tags podem ser usadas em qualquer contexto (clientes, conversas, tickets, etc).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva quando usar esta tag"
              rows={2}
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
              disabled={!name || createTag.isPending || updateTag.isPending}
            >
              {isEditing ? "Salvar" : "Criar Tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
