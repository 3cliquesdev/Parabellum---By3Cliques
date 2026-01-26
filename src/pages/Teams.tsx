import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useTeams, useDeleteTeam } from "@/hooks/useTeams";
import TeamDialog from "@/components/teams/TeamDialog";
import TeamMembersDialog from "@/components/teams/TeamMembersDialog";
import TeamSettingsDialog from "@/components/teams/TeamSettingsDialog";
import TeamCard from "@/components/teams/TeamCard";

export default function Teams() {
  const { data: teams, isLoading } = useTeams();
  const deleteTeam = useDeleteTeam();
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [managingMembersTeam, setManagingMembersTeam] = useState<string | null>(null);
  const [settingsTeam, setSettingsTeam] = useState<string | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleDelete = () => {
    if (deletingTeam) {
      deleteTeam.mutate(deletingTeam);
      setDeletingTeam(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Times</h1>
          <p className="text-muted-foreground">Organize seus agentes em grupos de atendimento</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Time
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams?.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            onEdit={() => setEditingTeam(team.id)}
            onManageMembers={() => setManagingMembersTeam(team.id)}
            onSettings={() => setSettingsTeam(team.id)}
            onDelete={() => setDeletingTeam(team.id)}
          />
        ))}
      </div>

      {teams?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum time criado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie times para organizar seus agentes em grupos de atendimento.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Time
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <TeamDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      {/* Edit Dialog */}
      {editingTeam && (
        <TeamDialog
          open={!!editingTeam}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          teamId={editingTeam}
        />
      )}

      {/* Manage Members Dialog */}
      {managingMembersTeam && (
        <TeamMembersDialog
          open={!!managingMembersTeam}
          onOpenChange={(open) => !open && setManagingMembersTeam(null)}
          teamId={managingMembersTeam}
        />
      )}

      {/* Settings Dialog */}
      {settingsTeam && (
        <TeamSettingsDialog
          open={!!settingsTeam}
          onOpenChange={(open) => !open && setSettingsTeam(null)}
          teamId={settingsTeam}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => !open && setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Time?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação desativará o time. Os membros serão removidos automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
