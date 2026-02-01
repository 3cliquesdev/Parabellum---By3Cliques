import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Shield, Loader2, ArrowLeft, MessageSquare, Mail, ShoppingCart, Instagram } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AIModelConfigCard from "@/components/settings/AIModelConfigCard";
import { AITrainerStatsWidget } from "@/components/settings/AITrainerStatsWidget";
import { WhatsAppMetaIntegrationCard } from "@/components/integrations/WhatsAppMetaIntegrationCard";
import { EmailResendIntegrationCard } from "@/components/integrations/EmailResendIntegrationCard";
import { KiwifyIntegrationCardNew } from "@/components/integrations/KiwifyIntegrationCardNew";

export default function IntegrationsSettings() {
  const { hasPermission, loading } = useRolePermissions();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission("settings.integrations")) {
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
        <Button
          variant="ghost"
          onClick={() => navigate("/settings")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Configurações
        </Button>
        
        <h1 className="text-3xl font-bold text-foreground">Central de Integrações</h1>
        <p className="text-muted-foreground mt-2">
          Configure suas próprias credenciais de integrações
        </p>
      </div>

      {/* Seção: IA */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          🤖 Inteligência Artificial
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIModelConfigCard />
          <AITrainerStatsWidget />
        </div>
      </div>

      {/* Seção: Canais de Comunicação */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-600" />
          Canais de Comunicação
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WhatsAppMetaIntegrationCard />
          
          {/* Instagram Card - OAuth only */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted text-pink-600">
                    <Instagram className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Instagram</CardTitle>
                    <CardDescription>Conecte sua conta via OAuth</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">OAuth</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Para conectar o Instagram, use o botão abaixo. As credenciais do app são gerenciadas pelo administrador do sistema.
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate("/settings/instagram")}
                className="w-full"
              >
                <Instagram className="h-4 w-4 mr-2" />
                Gerenciar Contas Instagram
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seção: Email */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          E-mail
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EmailResendIntegrationCard />
        </div>
      </div>

      {/* Seção: E-commerce */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-orange-600" />
          E-commerce
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <KiwifyIntegrationCardNew />
        </div>
      </div>
    </div>
  );
}
