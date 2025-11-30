import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MacroDialog } from "@/components/MacroDialog";
import { useCannedResponses, useDeleteCannedResponse, CannedResponse } from "@/hooks/useCannedResponses";
import { useDepartments } from "@/hooks/useDepartments";
import { Plus, Search, Edit, Trash2, Zap, Users, Building } from "lucide-react";
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

export default function Macros() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMacro, setSelectedMacro] = useState<CannedResponse | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [macroToDelete, setMacroToDelete] = useState<string | null>(null);

  const { data: macros = [], isLoading } = useCannedResponses(searchQuery);
  const { data: departments = [] } = useDepartments();
  const deleteMacro = useDeleteCannedResponse();

  const handleEdit = (macro: CannedResponse) => {
    setSelectedMacro(macro);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedMacro(null);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setMacroToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (macroToDelete) {
      await deleteMacro.mutateAsync(macroToDelete);
      setDeleteDialogOpen(false);
      setMacroToDelete(null);
    }
  };

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return null;
    const dept = departments.find(d => d.id === deptId);
    return dept?.name;
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-8 w-8 text-primary" />
              Macros - Respostas Prontas
            </h1>
            <p className="text-muted-foreground mt-2">
              Crie atalhos rápidos para mensagens frequentes. Digite "/" no chat para usar.
            </p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Macro
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, atalho ou conteúdo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Carregando macros...
        </div>
      ) : macros.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Zap className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                {searchQuery ? "Nenhuma macro encontrada" : "Nenhuma macro criada ainda"}
              </p>
              <p className="text-sm mb-4">
                {searchQuery 
                  ? "Tente outro termo de busca"
                  : "Crie sua primeira resposta pronta para agilizar o atendimento"
                }
              </p>
              {!searchQuery && (
                <Button onClick={handleNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Macro
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {macros.map((macro) => (
            <Card key={macro.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-primary font-mono">/{macro.shortcut}</span>
                      {macro.is_public && (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          Equipe
                        </Badge>
                      )}
                      {!macro.is_public && (
                        <Badge variant="outline" className="text-xs">
                          Pessoal
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{macro.title}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(macro)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(macro.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 p-3 rounded-lg mb-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">
                    {macro.content}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {macro.department_id && (
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {getDepartmentName(macro.department_id)}
                      </span>
                    )}
                    {!macro.department_id && macro.is_public && (
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        Global
                      </span>
                    )}
                  </div>
                  <span className="font-medium">
                    {macro.usage_count > 0 ? `${macro.usage_count}x usada` : "Nunca usada"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MacroDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        macro={selectedMacro}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Macro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta macro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
