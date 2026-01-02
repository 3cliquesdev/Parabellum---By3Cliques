import { useState } from "react";
import { Plus, Play, Pause, Users, CheckCircle, MessageSquare, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCadences } from "@/hooks/useCadences";
import { useUpdateCadence } from "@/hooks/useUpdateCadence";
import { useDeleteCadence } from "@/hooks/useDeleteCadence";
import { useCadenceEnrollments } from "@/hooks/useCadenceEnrollments";
import CadenceDialog from "@/components/CadenceDialog";
import { CadenceEnrollDialog } from "@/components/CadenceEnrollDialog";
import { useUserRole } from "@/hooks/useUserRole";

export default function Cadences() {
  const { data: cadences, isLoading } = useCadences();
  const { mutate: updateCadence } = useUpdateCadence();
  const { mutate: deleteCadence } = useDeleteCadence();
  const [selectedCadence, setSelectedCadence] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [enrollDialogCadence, setEnrollDialogCadence] = useState<{ id: string; name: string } | null>(null);
  const { isAdmin, isManager, isGeneralManager } = useUserRole();
  
  const canManage = isAdmin || isManager || isGeneralManager;

  const handleToggleActive = (cadence: any) => {
    updateCadence({
      id: cadence.id,
      is_active: !cadence.is_active,
    });
  };

  const handleEdit = (cadence: any) => {
    setSelectedCadence(cadence);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedCadence(null);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando cadências...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">🔄 Cadências de Prospecção</h1>
          <p className="text-muted-foreground mt-1">
            Automatize seu follow-up multi-canal e organize sua rotina de vendas
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Nova Cadência
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cadências</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cadences?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cadences?.filter((c) => c.is_active).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pausadas</CardTitle>
            <Pause className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cadences?.filter((c) => !c.is_active).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Inscritos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Em todas as cadências</p>
          </CardContent>
        </Card>
      </div>

      {/* Cadences List */}
      <div className="space-y-4">
        {cadences?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma cadência criada</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie sua primeira cadência para automatizar o follow-up de leads
              </p>
              {canManage && (
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeira Cadência
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          cadences?.map((cadence) => (
            <CadenceCard
              key={cadence.id}
              cadence={cadence}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
              onDelete={deleteCadence}
              onEnroll={() => setEnrollDialogCadence({ id: cadence.id, name: cadence.name })}
              canManage={canManage}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <CadenceDialog
        cadence={selectedCadence}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedCadence(null);
        }}
      />

      <CadenceEnrollDialog
        cadence={enrollDialogCadence}
        open={!!enrollDialogCadence}
        onOpenChange={(open) => !open && setEnrollDialogCadence(null)}
      />
    </div>
  );
}

interface CadenceCardProps {
  cadence: any;
  onEdit: (cadence: any) => void;
  onToggleActive: (cadence: any) => void;
  onDelete: (id: string) => void;
  onEnroll: () => void;
  canManage: boolean;
}

function CadenceCard({ cadence, onEdit, onToggleActive, onDelete, onEnroll, canManage }: CadenceCardProps) {
  const { data: enrollments } = useCadenceEnrollments({ cadenceId: cadence.id });
  
  const activeEnrollments = enrollments?.filter((e) => e.status === "active").length || 0;
  const repliedEnrollments = enrollments?.filter((e) => e.status === "replied").length || 0;
  const completedEnrollments = enrollments?.filter((e) => e.status === "completed").length || 0;

  return (
    <Card className={!cadence.is_active ? "opacity-60" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{cadence.name}</CardTitle>
              <Badge variant={cadence.is_active ? "default" : "secondary"}>
                {cadence.is_active ? "✅ Ativa" : "⏸️ Pausada"}
              </Badge>
            </div>
            {cadence.description && (
              <CardDescription>{cadence.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Total de Inscritos:</span>
            <span className="ml-2 font-semibold">{enrollments?.length || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ativos:</span>
            <span className="ml-2 font-semibold text-blue-600">{activeEnrollments}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Responderam:</span>
            <span className="ml-2 font-semibold text-green-600">{repliedEnrollments}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Concluídos:</span>
            <span className="ml-2 font-semibold text-gray-600">{completedEnrollments}</span>
          </div>
        </div>

        {/* Actions */}
        {canManage && (
          <div className="flex gap-2 pt-2 border-t">
            <Button onClick={onEnroll} variant="default" size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Inscrever Contatos
            </Button>
            <Button onClick={() => onEdit(cadence)} variant="outline" size="sm">
              Editar Passos
            </Button>
            <Button
              onClick={() => onToggleActive(cadence)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {cadence.is_active ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Ativar
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                if (confirm("Tem certeza que deseja deletar esta cadência?")) {
                  onDelete(cadence.id);
                }
              }}
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              Deletar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
