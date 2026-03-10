import { useState } from "react";
import { Plus, Pencil, Trash2, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTicketCategories, useDeleteTicketCategory, TicketCategory } from "@/hooks/useTicketCategories";
import { TicketCategoryDialog } from "@/components/tickets/TicketCategoryDialog";

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export default function TicketCategoriesSettings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TicketCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<TicketCategory | null>(null);

  const { data: categories = [], isLoading } = useTicketCategories();
  const deleteMutation = useDeleteTicketCategory();

  const handleEdit = (cat: TicketCategory) => {
    setEditingCategory(cat);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteCategory) {
      await deleteMutation.mutateAsync(deleteCategory.id);
      setDeleteCategory(null);
    }
  };

  const handleNew = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Categorias de Ticket
          </h1>
          <p className="text-muted-foreground">
            Gerencie as categorias disponíveis para tickets e fluxos
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Categorias Cadastradas</CardTitle>
          <CardDescription>
            Categorias usadas em tickets, fluxos de atendimento e regras de notificação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando categorias...
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <TagIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhuma categoria encontrada</p>
              <Button variant="outline" className="mt-4" onClick={handleNew}>
                Criar primeira categoria
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade Padrão</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <Badge
                        style={{
                          backgroundColor: cat.color || "#6B7280",
                          color: "#fff",
                        }}
                      >
                        {cat.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {priorityLabels[cat.priority] || cat.priority}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {cat.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cat.is_active ? "default" : "secondary"}>
                        {cat.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cat)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteCategory(cat)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TicketCategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
      />

      <AlertDialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{deleteCategory?.name}"? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
