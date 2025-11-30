import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserPlus, Edit, MoreVertical, Ban, CheckCircle, Archive, ArchiveRestore, Mail } from "lucide-react";
import UserDialog from "@/components/UserDialog";
import { BlockUserDialog } from "@/components/BlockUserDialog";
import { ArchiveUserDialog } from "@/components/ArchiveUserDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { useUsers } from "@/hooks/useUsers";
import { useManageUserStatus } from "@/hooks/useManageUserStatus";
import { useResendWelcomeEmail } from "@/hooks/useResendWelcomeEmail";
import { useProfileSkills } from "@/hooks/useProfileSkills";

// Import type from useUsers hook
type UserWithRole = NonNullable<ReturnType<typeof useUsers>['data']>[number];

// Component to display user skills
function UserSkillsBadges({ userId }: { userId: string }) {
  const { data: profileSkills } = useProfileSkills(userId);
  
  if (!profileSkills || profileSkills.length === 0) {
    return <span className="text-xs text-muted-foreground">Sem habilidades</span>;
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      {profileSkills.map((ps) => (
        <Badge
          key={ps.skill_id}
          variant="outline"
          className="text-xs"
          style={{
            borderColor: ps.skill.color,
            color: ps.skill.color
          }}
        >
          {ps.skill.name}
        </Badge>
      ))}
    </div>
  );
}

export default function Users() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'archived'>('all');
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { role, isAdmin, isGeneralManager, loading: roleLoading } = useUserRole();
  const { data: users, isLoading } = useUsers();
  const manageUserStatus = useManageUserStatus();
  const resendWelcomeEmail = useResendWelcomeEmail();

  // Redirect if not admin or general_manager - only after role is loaded and confirmed
  useEffect(() => {
    console.log("[Users] Checking access", { roleLoading, role, isAdmin, isGeneralManager });
    
    // Only redirect if role is loaded AND user is confirmed not admin/general_manager
    if (!roleLoading && role !== null && !isAdmin && !isGeneralManager) {
      console.log("[Users] User is not admin/general_manager, redirecting to dashboard");
      navigate("/");
    }
  }, [role, isAdmin, isGeneralManager, roleLoading, navigate]);

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    setEditingUser(null);
  };

  const handleEditClick = (user: UserWithRole) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingUser(null);
    }
  };

  const handleBlock = (user: UserWithRole) => {
    setSelectedUser(user);
    setBlockDialogOpen(true);
  };

  const handleUnblock = (user: UserWithRole) => {
    manageUserStatus.mutate({ user_id: user.id, action: 'unblock' });
  };

  const handleArchive = (user: UserWithRole) => {
    setSelectedUser(user);
    setArchiveDialogOpen(true);
  };

  const handleUnarchive = (user: UserWithRole) => {
    manageUserStatus.mutate({ user_id: user.id, action: 'unarchive' });
  };

  const handleResendEmail = (user: UserWithRole) => {
    resendWelcomeEmail.mutate({ user_id: user.id });
  };

  const handleBlockConfirm = (reason: string) => {
    if (selectedUser) {
      manageUserStatus.mutate({ user_id: selectedUser.id, action: 'block', reason });
    }
  };

  const handleArchiveConfirm = () => {
    if (selectedUser) {
      manageUserStatus.mutate({ user_id: selectedUser.id, action: 'archive' });
    }
  };

  const filteredUsers = users?.filter(user => {
    if (statusFilter === 'blocked') return user.is_blocked;
    if (statusFilter === 'archived') return user.is_archived;
    if (statusFilter === 'active') return !user.is_blocked && !user.is_archived;
    return true;
  });

  if (roleLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "Administrador (Super Admin)",
    general_manager: "Gerente Geral",
    manager: "Gerente de Vendas",
    sales_rep: "Vendedor",
    consultant: "Consultor",
    support_agent: "Agente de Suporte",
    support_manager: "Gerente de Suporte",
    financial_manager: "Gerente Financeiro",
    cs_manager: "Gerente de CS",
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    if (role === "admin") return "default";
    if (role === "general_manager") return "secondary";
    if (role === "manager") return "secondary";
    return "outline";
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie os usuários do sistema e suas permissões
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usuários Cadastrados</CardTitle>
              <CardDescription>
                Lista de todos os usuários com acesso ao sistema
              </CardDescription>
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="blocked">Bloqueados</TabsTrigger>
                <TabsTrigger value="archived">Arquivados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Perfil de Acesso</TableHead>
                <TableHead>Habilidades</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user) => (
                <TableRow key={user.id} className={user.is_blocked || user.is_archived ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border-2 border-primary/20 transition-all hover:border-primary hover:scale-105">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {user.full_name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.full_name || "Sem nome"}</span>
                          {user.is_blocked && (
                            <Badge variant="destructive" className="text-xs">
                              🚫 Bloqueado
                            </Badge>
                          )}
                          {user.is_archived && (
                            <Badge variant="secondary" className="text-xs">
                              📦 Arquivado
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.job_title || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UserSkillsBadges userId={user.id} />
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled={user.role === 'admin' && isGeneralManager && !isAdmin}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleEditClick(user)}
                          disabled={user.role === 'admin' && isGeneralManager && !isAdmin}
                        >
                          <Edit className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResendEmail(user)}>
                          <Mail className="mr-2 h-4 w-4 text-blue-500" /> Reenviar Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.is_blocked ? (
                          <DropdownMenuItem 
                            onClick={() => handleUnblock(user)}
                            disabled={user.role === 'admin' && isGeneralManager && !isAdmin}
                          >
                            <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Desbloquear
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleBlock(user)} 
                            className="text-destructive"
                            disabled={user.role === 'admin' && isGeneralManager && !isAdmin}
                          >
                            <Ban className="mr-2 h-4 w-4" /> Bloquear
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {user.is_archived ? (
                          <DropdownMenuItem 
                            onClick={() => handleUnarchive(user)}
                            disabled={user.role === 'admin' && isGeneralManager && !isAdmin}
                          >
                            <ArchiveRestore className="mr-2 h-4 w-4" /> Desarquivar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleArchive(user)}
                            disabled={user.role === 'admin' && isGeneralManager && !isAdmin}
                          >
                            <Archive className="mr-2 h-4 w-4" /> Arquivar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredUsers || filteredUsers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserDialog 
        open={dialogOpen} 
        onOpenChange={handleDialogClose} 
        onSuccess={handleSuccess}
        editUser={editingUser}
      />

      <BlockUserDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        userName={selectedUser?.full_name || selectedUser?.email || ''}
        onConfirm={handleBlockConfirm}
      />

      <ArchiveUserDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        userName={selectedUser?.full_name || selectedUser?.email || ''}
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}
