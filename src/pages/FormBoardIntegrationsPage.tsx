import { useState } from "react";
import { Plus, Trash2, Settings2, Link2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFormBoardIntegrations,
  useDeleteFormBoardIntegration,
  useUpdateFormBoardIntegration,
} from "@/hooks/useFormBoardIntegrations";
import { FormBoardIntegrationDialog } from "@/components/forms/FormBoardIntegrationDialog";

export default function FormBoardIntegrationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: integrations, isLoading } = useFormBoardIntegrations();
  const deleteIntegration = useDeleteFormBoardIntegration();
  const updateIntegration = useUpdateFormBoardIntegration();

  const handleEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    updateIntegration.mutate({ id, is_active: !currentActive });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteIntegration.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integração Formulário → Kanban</h1>
          <p className="text-muted-foreground">
            Configure quais formulários criam cards automaticamente em boards do Kanban
          </p>
        </div>
        <Button onClick={() => { setEditingId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Integração
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Integrações Ativas
          </CardTitle>
          <CardDescription>
            Quando um formulário é preenchido, um card é criado automaticamente no board configurado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !integrations?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma integração configurada</p>
              <p className="text-sm">Clique em "Nova Integração" para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Formulário</TableHead>
                  <TableHead>Board de Destino</TableHead>
                  <TableHead>Coluna Inicial</TableHead>
                  <TableHead>Email Confirmação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell className="font-medium">
                      {integration.form?.name || "Formulário removido"}
                    </TableCell>
                    <TableCell>
                      {integration.board?.name || "Board removido"}
                    </TableCell>
                    <TableCell>
                      {integration.target_column?.name || "Primeira coluna"}
                    </TableCell>
                    <TableCell>
                      {integration.send_confirmation_email ? (
                        <Badge variant="secondary">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Desativado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {integration.is_active ? (
                        <Badge className="bg-green-500">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(integration.id, integration.is_active)}
                          title={integration.is_active ? "Desativar" : "Ativar"}
                        >
                          {integration.is_active ? (
                            <ToggleRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(integration.id)}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(integration.id)}
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

      <FormBoardIntegrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir integração?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A integração será removida e formulários não criarão mais cards automaticamente.
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
