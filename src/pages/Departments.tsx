import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Loader2, Clock, MessageSquare, Timer, Tag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDepartments, type Department } from "@/hooks/useDepartments";
import { useDeleteDepartment } from "@/hooks/useDeleteDepartment";
import { useUpdateDepartment } from "@/hooks/useUpdateDepartment";
import { useTicketOperations, useUpdateTicketOperation, useDeleteTicketOperation, type TicketOperation } from "@/hooks/useTicketOperations";
import { useTicketCategories, useUpdateTicketCategory, useDeleteTicketCategory, type TicketCategory } from "@/hooks/useTicketCategories";
import { useTicketOrigins, useUpdateTicketOrigin, useDeleteTicketOrigin, type TicketOrigin } from "@/hooks/useTicketOrigins";
import { useSLAPolicies } from "@/hooks/useSLAPolicies";
import { useTicketFieldSettings } from "@/hooks/useTicketFieldSettings";
import { useConversationCloseSettings } from "@/hooks/useConversationCloseSettings";
import DepartmentDialog from "@/components/DepartmentDialog";
import OperationDialog from "@/components/OperationDialog";
import CategoryDialog from "@/components/CategoryDialog";
import OriginDialog from "@/components/OriginDialog";
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

  // Origin state
  const [originDialogOpen, setOriginDialogOpen] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState<TicketOrigin | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: "dept" | "op" | "cat" | "origin" } | null>(null);

  // Data hooks
  const { data: departments, isLoading: loadingDepts } = useDepartments();
  const { data: operations, isLoading: loadingOps } = useTicketOperations();
  const { data: categories, isLoading: loadingCats } = useTicketCategories();
  const { data: origins, isLoading: loadingOrigins } = useTicketOrigins();
  const { data: slaPolicies } = useSLAPolicies();
  const { settings: fieldSettings, updateField } = useTicketFieldSettings();
  const { tagsRequired: convTagsRequired, updateTagsRequired } = useConversationCloseSettings();

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
  const updateOriginMutation = useUpdateTicketOrigin();
  const deleteOriginMutation = useDeleteTicketOrigin();

  const handleCreate = () => {
    if (activeTab === "departments") { setSelectedDepartment(null); setDeptDialogOpen(true); }
    else if (activeTab === "operations") { setSelectedOperation(null); setOpDialogOpen(true); }
    else if (activeTab === "origins") { setSelectedOrigin(null); setOriginDialogOpen(true); }
    else { setSelectedCategory(null); setCatDialogOpen(true); }
  };

  const handleDelete = (id: string, type: "dept" | "op" | "cat" | "origin") => {
    setDeleteTarget({ id, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "dept") await deleteDeptMutation.mutateAsync(deleteTarget.id);
    else if (deleteTarget.type === "op") await deleteOpMutation.mutateAsync(deleteTarget.id);
    else if (deleteTarget.type === "origin") await deleteOriginMutation.mutateAsync(deleteTarget.id);
    else await deleteCatMutation.mutateAsync(deleteTarget.id);
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const tabConfig: Record<string, { title: string; subtitle: string; btnLabel?: string }> = {
    departments: { title: "Departamentos", subtitle: "Gerencie os departamentos organizacionais", btnLabel: "Novo Departamento" },
    operations: { title: "Operações", subtitle: "Gerencie as operações de tickets", btnLabel: "Nova Operação" },
    categories: { title: "Categorias", subtitle: "Gerencie as categorias de tickets", btnLabel: "Nova Categoria" },
    origins: { title: "Origens", subtitle: "Gerencie as origens (momento da jornada do cliente)", btnLabel: "Nova Origem" },
    fields: { title: "Campos Obrigatórios", subtitle: "Defina quais campos são obrigatórios ao criar um ticket" },
  };

  const current = tabConfig[activeTab] || tabConfig.departments;
  const isLoading = loadingDepts || loadingOps || loadingCats || loadingOrigins;

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
        {current.btnLabel && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {current.btnLabel}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="departments">Departamentos</TabsTrigger>
          <TabsTrigger value="operations">Operações</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="origins">Origens</TabsTrigger>
          <TabsTrigger value="fields">Campos</TabsTrigger>
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
                    {department.ai_auto_close_minutes != null && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Timer className="h-4 w-4" />
                        <span>IA auto-fecha em {department.ai_auto_close_minutes} min</span>
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

        {/* === ORIGENS === */}
        <TabsContent value="origins">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {origins?.map((origin) => (
              <Card key={origin.id} className="relative">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: origin.color }} />
                    <div>
                      <CardTitle className="text-lg">{origin.name}</CardTitle>
                      <CardDescription className="mt-1">{origin.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={origin.is_active}
                        onCheckedChange={() => updateOriginMutation.mutateAsync({ id: origin.id, is_active: !origin.is_active })}
                      />
                      <span className="text-sm text-muted-foreground">{origin.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedOrigin(origin); setOriginDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(origin.id, "origin")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* === CAMPOS OBRIGATÓRIOS === */}
        <TabsContent value="fields">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {([
              { field: "department" as const, label: "Departamento Responsável", desc: "Departamento ao qual o ticket será vinculado" },
              { field: "operation" as const, label: "Operação", desc: "Tipo de operação do ticket" },
              { field: "origin" as const, label: "Origem do Ticket", desc: "Momento da jornada do cliente" },
              { field: "category" as const, label: "Categoria", desc: "Classificação do ticket por tipo de problema" },
              { field: "customer" as const, label: "Cliente", desc: "Cliente vinculado ao ticket" },
              { field: "assigned_to" as const, label: "Responsável (Atribuir a)", desc: "Agente responsável pelo ticket" },
              { field: "tags" as const, label: "Tags", desc: "Etiquetas de classificação do ticket" },
            ]).map(({ field, label, desc }) => (
              <Card key={field}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {fieldSettings[field] ? "Obrigatório" : "Opcional"}
                    </span>
                    <Switch
                      checked={fieldSettings[field]}
                      onCheckedChange={(checked) => updateField({ field, required: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Conversas (Chat)</h3>
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-foreground">Tags obrigatórias ao encerrar conversa</p>
                  <p className="text-sm text-muted-foreground">Impede o encerramento de conversas sem pelo menos uma tag</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {convTagsRequired ? "Obrigatório" : "Opcional"}
                  </span>
                  <Switch
                    checked={convTagsRequired}
                    onCheckedChange={(checked) => updateTagsRequired(checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <DepartmentDialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen} department={selectedDepartment} />
      <OperationDialog open={opDialogOpen} onOpenChange={setOpDialogOpen} operation={selectedOperation} />
      <CategoryDialog open={catDialogOpen} onOpenChange={setCatDialogOpen} category={selectedCategory} />
      <OriginDialog open={originDialogOpen} onOpenChange={setOriginDialogOpen} origin={selectedOrigin} />

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
