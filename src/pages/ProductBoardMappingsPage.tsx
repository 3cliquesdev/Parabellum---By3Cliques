import { useState } from "react";
import {
  useProductBoardMappings,
  useDeleteProductBoardMapping,
  useUpdateProductBoardMapping,
} from "@/hooks/useProductBoardMappings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Package, Columns3, FileText, Mail, User, ArrowRight } from "lucide-react";
import { ProductBoardMappingDialog } from "@/components/products/ProductBoardMappingDialog";
import type { ProductBoardMapping } from "@/hooks/useProductBoardMappings";

export default function ProductBoardMappingsPage() {
  const { data: mappings, isLoading } = useProductBoardMappings();
  const updateMutation = useUpdateProductBoardMapping();
  const deleteMutation = useDeleteProductBoardMapping();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<ProductBoardMapping | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (mapping: ProductBoardMapping) => {
    setEditingMapping(mapping);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingMapping(null);
    setDialogOpen(true);
  };

  const handleToggleActive = (mapping: ProductBoardMapping) => {
    updateMutation.mutate({
      id: mapping.id,
      is_active: !mapping.is_active,
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Mapeamento Produto → Kanban
          </h1>
          <p className="text-muted-foreground">
            Configure quais produtos Kiwify criam cards automáticos no Kanban
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Mapeamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mapeamentos Configurados
          </CardTitle>
          <CardDescription>
            Quando um cliente compra um produto mapeado, um card é criado
            automaticamente no board configurado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : !mappings?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum mapeamento configurado. Clique em "Novo Mapeamento" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Fluxo Kanban</TableHead>
                  <TableHead>Formulário</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div className="font-medium">
                        {mapping.product?.name || "Produto não encontrado"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Columns3 className="h-3 w-3" />
                          {mapping.board?.name}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="secondary">
                          {mapping.initial_column?.name}
                        </Badge>
                        {mapping.form_filled_column && (
                          <>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary">
                              {mapping.form_filled_column.name}
                            </Badge>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {mapping.form ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <FileText className="h-3 w-3" />
                          {mapping.form.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {mapping.auto_assign_user ? (
                        <div className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3" />
                          {mapping.auto_assign_user.full_name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {mapping.send_welcome_email ? (
                        <Badge className="flex items-center gap-1 w-fit bg-green-100 text-green-800">
                          <Mail className="h-3 w-3" />
                          Sim
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={mapping.is_active}
                        onCheckedChange={() => handleToggleActive(mapping)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(mapping)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(mapping.id)}
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

      <ProductBoardMappingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mapping={editingMapping}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mapeamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O mapeamento será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
