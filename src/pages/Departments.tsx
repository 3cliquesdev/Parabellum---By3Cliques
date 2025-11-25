import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useDepartments, type Department } from "@/hooks/useDepartments";
import { useDeleteDepartment } from "@/hooks/useDeleteDepartment";
import { useUpdateDepartment } from "@/hooks/useUpdateDepartment";
import DepartmentDialog from "@/components/DepartmentDialog";
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
import { Switch } from "@/components/ui/switch";

export default function Departments() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<string | null>(null);

  const { data: departments, isLoading } = useDepartments();
  const deleteMutation = useDeleteDepartment();
  const updateMutation = useUpdateDepartment();

  const handleEdit = (department: Department) => {
    setSelectedDepartment(department);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedDepartment(null);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDepartmentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (departmentToDelete) {
      await deleteMutation.mutateAsync(departmentToDelete);
      setDeleteDialogOpen(false);
      setDepartmentToDelete(null);
    }
  };

  const toggleActive = async (department: Department) => {
    await updateMutation.mutateAsync({
      id: department.id,
      is_active: !department.is_active,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Departamentos</h1>
          <p className="text-muted-foreground mt-2">Gerencie os departamentos organizacionais</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Departamento
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments?.map((department) => (
          <Card key={department.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: department.color }}
                  />
                  <div>
                    <CardTitle className="text-lg">{department.name}</CardTitle>
                    <CardDescription className="mt-1">{department.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={department.is_active}
                    onCheckedChange={() => toggleActive(department)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {department.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(department)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(department.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        department={selectedDepartment}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este departamento? Esta ação não pode ser desfeita.
              Não é possível deletar departamentos com usuários vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
