import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import EmailConfigCard from "@/components/settings/EmailConfigCard";
import SecretsConfigCard from "@/components/settings/SecretsConfigCard";
import WebhooksConfigCard from "@/components/settings/WebhooksConfigCard";
import IntegrationsConfigCard from "@/components/settings/IntegrationsConfigCard";
import KiwifyIntegrationCard from "@/components/settings/KiwifyIntegrationCard";
import AIModelConfigCard from "@/components/settings/AIModelConfigCard";
import { AITrainerStatsWidget } from "@/components/settings/AITrainerStatsWidget";
import InstagramSecretsCard from "@/components/settings/InstagramSecretsCard";

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
          Gerencie email, API keys, webhooks e integrações externas em um só lugar
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIModelConfigCard />
        <AITrainerStatsWidget />
        <InstagramSecretsCard />
        <KiwifyIntegrationCard />
        <EmailConfigCard />
        <SecretsConfigCard />
        <WebhooksConfigCard />
        <IntegrationsConfigCard />
      </div>
    </div>
  );
}
