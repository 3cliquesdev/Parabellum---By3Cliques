import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Loader2, Clock, MessageSquare, Timer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDepartments, type Department } from "@/hooks/useDepartments";
import { useDeleteDepartment } from "@/hooks/useDeleteDepartment";
import { useUpdateDepartment } from "@/hooks/useUpdateDepartment";
import { useTicketOperations, useUpdateTicketOperation, useDeleteTicketOperation, type TicketOperation } from "@/hooks/useTicketOperations";
import { useTicketCategories, useUpdateTicketCategory, useDeleteTicketCategory, type TicketCategory } from "@/hooks/useTicketCategories";
import { useSLAPolicies } from "@/hooks/useSLAPolicies";
import DepartmentDialog from "@/components/DepartmentDialog";
import OperationDialog from "@/components/OperationDialog";
import CategoryDialog from "@/components/CategoryDialog";
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
  const [activeTab, setActiveTab] = useState("departments");

  // Department state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  // Operation state
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<TicketOperation | null>(null);

  // Category state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: "dept" | "op" | "cat" } | null>(null);

  // Data hooks
  const { data: departments, isLoading: loadingDepts } = useDepartments();
  const { data: operations, isLoading: loadingOps } = useTicketOperations();
  const { data: categories, isLoading: loadingCats } = useTicketCategories();
  const { data: slaPolicies } = useSLAPolicies();

  const unitLabels: Record<string, string> = { hours: "h", business_hours: "h úteis", business_days: "d úteis" };
  const getSlaForCategory = (catId: string, prio: string) => {
    return slaPolicies?.find(p => p.category_id === catId && p.priority === prio && p.is_active);
  };

  const deleteDeptMutation = useDeleteDepartment();
  const updateDeptMutation = useUpdateDepartment();
  const updateOpMutation = useUpdateTicketOperation();
  const deleteOpMutation = useDeleteTicketOperation();
  const updateCatMutation = useUpdateTicketCategory();
  const deleteCatMutation = useDeleteTicketCategory();

  const handleCreate = () => {
    if (activeTab === "departments") { setSelectedDepartment(null); setDeptDialogOpen(true); }
    else if (activeTab === "operations") { setSelectedOperation(null); setOpDialogOpen(true); }
    else { setSelectedCategory(null); setCatDialogOpen(true); }
  };

  const handleDelete = (id: string, type: "dept" | "op" | "cat") => {
    setDeleteTarget({ id, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "dept") await deleteDeptMutation.mutateAsync(deleteTarget.id);
    else if (deleteTarget.type === "op") await deleteOpMutation.mutateAsync(deleteTarget.id);
    else await deleteCatMutation.mutateAsync(deleteTarget.id);
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const tabConfig = {
    departments: { title: "Departamentos", subtitle: "Gerencie os departamentos organizacionais", btnLabel: "Novo Departamento" },
    operations: { title: "Operações", subtitle: "Gerencie as operações de tickets", btnLabel: "Nova Operação" },
    categories: { title: "Categorias", subtitle: "Gerencie as categorias de tickets", btnLabel: "Nova Categoria" },
  };

  const current = tabConfig[activeTab as keyof typeof tabConfig];
  const isLoading = loadingDepts || loadingOps || loadingCats;

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
          <h1 className="text-3xl font-bold text-foreground">{current.title}</h1>
          <p className="text-muted-foreground mt-2">{current.subtitle}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {current.btnLabel}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="departments">Departamentos</TabsTrigger>
          <TabsTrigger value="operations">Operações</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        {/* === DEPARTAMENTOS === */}
        <TabsContent value="departments">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {departments?.map((department) => (
              <Card key={department.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: department.color }} />
                      <div>
                        <CardTitle className="text-lg">{department.name}</CardTitle>
                        <CardDescription className="mt-1">{department.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {department.auto_close_enabled && department.auto_close_minutes && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Auto-fecha em {department.auto_close_minutes} min</span>
                        {department.send_rating_on_close && (
                          <>
                            <MessageSquare className="h-4 w-4 ml-2" />
                            <span>+ CSAT</span>
                          </>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={department.is_active}
                          onCheckedChange={() => updateDeptMutation.mutateAsync({ id: department.id, is_active: !department.is_active })}
                        />
                        <span className="text-sm text-muted-foreground">{department.is_active ? "Ativo" : "Inativo"}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedDepartment(department); setDeptDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(department.id, "dept")}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* === OPERAÇÕES === */}
        <TabsContent value="operations">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {operations?.map((op) => (
              <Card key={op.id} className="relative">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: op.color }} />
                    <div>
                      <CardTitle className="text-lg">{op.name}</CardTitle>
                      <CardDescription className="mt-1">{op.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={op.is_active}
                        onCheckedChange={() => updateOpMutation.mutateAsync({ id: op.id, is_active: !op.is_active })}
                      />
                      <span className="text-sm text-muted-foreground">{op.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedOperation(op); setOpDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(op.id, "op")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* === CATEGORIAS === */}
        <TabsContent value="categories">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {categories?.map((cat) => (
              <Card key={cat.id} className="relative">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                    <div>
                      <CardTitle className="text-lg">{cat.name}</CardTitle>
                      <CardDescription className="mt-1">{cat.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {cat.priority && (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        Prioridade: {({ low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" } as Record<string, string>)[cat.priority] || cat.priority}
                      </span>
                    )}
                    {(() => {
                      const sla = getSlaForCategory(cat.id, cat.priority);
                      if (!sla) return null;
                      return (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Timer className="h-4 w-4" />
                          <span>
                            SLA: {sla.response_time_value}{unitLabels[sla.response_time_unit]} resposta / {sla.resolution_time_value}{unitLabels[sla.resolution_time_unit]} resolução
                          </span>
                        </div>
                      );
                    })()}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={cat.is_active}
                        onCheckedChange={() => updateCatMutation.mutateAsync({ id: cat.id, is_active: !cat.is_active })}
                      />
                      <span className="text-sm text-muted-foreground">{cat.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedCategory(cat); setCatDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id, "cat")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DepartmentDialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen} department={selectedDepartment} />
      <OperationDialog open={opDialogOpen} onOpenChange={setOpDialogOpen} operation={selectedOperation} />
      <CategoryDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} category={selectedCategory} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este item? Esta ação não pode ser desfeita.
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
