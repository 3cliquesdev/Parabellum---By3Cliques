import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProductTags, useCreateProductTag, useDeleteProductTag } from "@/hooks/useProductTags";
import { Plus, Trash2, Loader2, Tag } from "lucide-react";

interface ProductTagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductTagManager({ open, onOpenChange }: ProductTagManagerProps) {
  const { data: tags = [], isLoading } = useProductTags();
  const createTag = useCreateProductTag();
  const deleteTag = useDeleteProductTag();
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await createTag.mutateAsync({ name: trimmed });
    setNewName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Gerenciar Product Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova product tag..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createTag.isPending}
              size="default"
            >
              {createTag.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Carregando...</div>
            ) : tags.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">Nenhuma product tag cadastrada.</div>
            ) : (
              tags.map((tag) => (
                <div key={tag.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50">
                  <Badge variant="outline" className="text-sm">{tag.name}</Badge>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteTag.mutate(tag.id)}
                    disabled={deleteTag.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Tags cadastradas aqui ficam disponíveis como dropdown nos artigos da base de conhecimento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
