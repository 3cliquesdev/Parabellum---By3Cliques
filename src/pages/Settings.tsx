import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Database, Mail, Webhook, Loader2, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { isAdmin, loading } = useUserRole();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Configurações do Sistema</h1>
        <p className="text-muted-foreground mt-2">Gerencie configurações globais da plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Banco de Dados
            </CardTitle>
            <CardDescription>Gerencie conexões e migrações</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Abrir Backend</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configurações de Email
            </CardTitle>
            <CardDescription>Configure provedores de email</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Configurar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Templates de Email
            </CardTitle>
            <CardDescription>Gerencie templates para automações</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/settings/email-templates')}>
              Gerenciar Templates
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Departamentos
            </CardTitle>
            <CardDescription>Configure departamentos organizacionais</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/settings/departments')}>
              Gerenciar Departamentos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Produtos
            </CardTitle>
            <CardDescription>Configure produtos e regras de distribuição</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/settings/products')}>
              Gerenciar Produtos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhooks
            </CardTitle>
            <CardDescription>Gerencie integrações externas</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Ver Webhooks</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>Políticas de acesso e RLS</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">Configurar</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
