import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePermissionsAudit, AuditUser, EffectivePermission, SecurityChecks } from "@/hooks/usePermissionsAudit";
import { Search, Shield, ShieldCheck, ShieldX, Download, User, CheckCircle2, XCircle, AlertTriangle, Database, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PermissionsAudit() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<AuditUser | null>(null);
  const { searchUsers, getEffectivePermissions, getSecurityChecks, exportToCSV } = usePermissionsAudit();
  const { toast } = useToast();

  // Query para buscar usuários
  const { data: users, isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ["audit-users", searchTerm],
    queryFn: () => searchUsers(searchTerm),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Query para permissões efetivas do usuário selecionado
  const { data: permissions, isLoading: loadingPermissions } = useQuery({
    queryKey: ["audit-permissions", selectedUser?.user_id],
    queryFn: () => getEffectivePermissions(selectedUser!.user_id),
    enabled: !!selectedUser?.user_id,
    staleTime: 30000,
  });

  // Query para security checks (carrega uma vez)
  const { data: securityChecks, isLoading: loadingSecurityChecks } = useQuery({
    queryKey: ["audit-security-checks"],
    queryFn: getSecurityChecks,
    staleTime: 60000,
  });

  const handleSearch = () => {
    if (searchTerm.length >= 2) {
      refetchUsers();
    }
  };

  const handleExportUsers = async () => {
    try {
      const allUsers = await searchUsers("");
      exportToCSV(
        allUsers.map(u => ({
          user_id: u.user_id,
          full_name: u.full_name || "",
          email: u.email || "",
          roles: u.roles.join(", ")
        })),
        "users-roles"
      );
      toast({ title: "Exportado", description: "Relatório de usuários exportado com sucesso." });
    } catch (error) {
      console.error('[PermissionsAudit] Export users failed:', error);
      toast({ variant: "destructive", title: "Erro", description: "Falha ao exportar usuários." });
    }
  };

  const handleExportPermissions = () => {
    if (!permissions || !selectedUser) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um usuário primeiro." });
      return;
    }
    
    exportToCSV(
      permissions.map(p => ({
        user_id: selectedUser.user_id,
        user_name: selectedUser.full_name || "",
        permission_key: p.permission_key,
        allowed: p.allowed ? "TRUE" : "FALSE",
        granted_by_roles: p.granted_by_roles?.join(", ") || ""
      })),
      `permissions-${selectedUser.full_name?.replace(/\s+/g, '-') || selectedUser.user_id}`
    );
    toast({ title: "Exportado", description: "Permissões exportadas com sucesso." });
  };

  const handleExportSecurityChecks = () => {
    if (!securityChecks) return;
    
    const tablesData = securityChecks.tables.map(t => ({
      type: "TABLE",
      name: t.table_name,
      rls_enabled: t.rls_enabled ? "TRUE" : "FALSE",
      rls_forced: t.rls_forced ? "TRUE" : "FALSE",
      security_definer: "",
      owner: ""
    }));
    
    const rpcsData = securityChecks.rpcs.map(r => ({
      type: "RPC",
      name: r.function_name,
      rls_enabled: "",
      rls_forced: "",
      security_definer: r.security_definer ? "TRUE" : "FALSE",
      owner: r.owner
    }));
    
    exportToCSV([...tablesData, ...rpcsData], "security-checks");
    toast({ title: "Exportado", description: "Verificações de segurança exportadas." });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Auditoria de Permissões
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verificar roles, permissões efetivas e configurações de segurança
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportUsers}>
            <Download className="h-4 w-4 mr-2" />
            Export Users CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportSecurityChecks} disabled={!securityChecks}>
            <Download className="h-4 w-4 mr-2" />
            Export Security CSV
          </Button>
        </div>
      </div>

      {/* Busca de Usuário */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Buscar Usuário
          </CardTitle>
          <CardDescription>
            Busque por nome, email ou ID do usuário
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Digite nome, email ou UUID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searchTerm.length < 2}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>

          {/* Lista de usuários encontrados */}
          {loadingUsers && (
            <div className="mt-4 text-sm text-muted-foreground">Buscando...</div>
          )}
          
          {users && users.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">{users.length} usuário(s) encontrado(s)</p>
              <div className="grid gap-2 max-h-[200px] overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.user_id}
                    onClick={() => setSelectedUser(user)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedUser?.user_id === user.user_id 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{user.full_name || "Sem nome"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissões Efetivas */}
      {selectedUser && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Permissões Efetivas
                </CardTitle>
                <CardDescription>
                  {selectedUser.full_name} ({selectedUser.email})
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportPermissions} disabled={!permissions}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPermissions && (
              <div className="text-sm text-muted-foreground">Carregando permissões...</div>
            )}
            
            {permissions && (
              <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {permissions.map((perm) => (
                  <div
                    key={perm.permission_key}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      {perm.allowed ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <code className="text-sm font-mono">{perm.permission_key}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={perm.allowed ? "default" : "secondary"}>
                        {perm.allowed ? "TRUE" : "FALSE"}
                      </Badge>
                      {perm.granted_by_roles && perm.granted_by_roles.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          via: {perm.granted_by_roles.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {permissions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma permissão encontrada para este usuário.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Security Checks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Verificações de Segurança
          </CardTitle>
          <CardDescription>
            Status de RLS nas tabelas e SECURITY DEFINER nas RPCs críticas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingSecurityChecks && (
            <div className="text-sm text-muted-foreground">Carregando verificações...</div>
          )}
          
          {securityChecks && (
            <>
              {/* Tabelas */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Tabelas Críticas
                </h4>
                <div className="grid gap-2">
                  {securityChecks.tables.map((table) => (
                    <div
                      key={table.table_name}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <code className="font-mono text-sm">{table.table_name}</code>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          {table.rls_enabled ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <ShieldX className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-xs">RLS={table.rls_enabled ? "ON" : "OFF"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {table.rls_forced ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                          <span className="text-xs">Force={table.rls_forced ? "ON" : "OFF"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RPCs */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  RPCs SECURITY DEFINER
                </h4>
                <div className="grid gap-2">
                  {securityChecks.rpcs.map((rpc, idx) => (
                    <div
                      key={`${rpc.function_name}-${idx}`}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <code className="font-mono text-sm">{rpc.function_name}</code>
                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-[400px]">
                          {rpc.signature}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          {rpc.security_definer ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <ShieldX className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-xs">
                            {rpc.security_definer ? "SECURITY DEFINER" : "INVOKER"}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          owner: {rpc.owner}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Última verificação: {new Date(securityChecks.checked_at).toLocaleString()}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
