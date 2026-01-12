import { ArrowLeft, Plug, Webhook, Key, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import WebhooksConfigCard from "@/components/settings/WebhooksConfigCard";
import SecretsConfigCard from "@/components/settings/SecretsConfigCard";
import IntegrationsConfigCard from "@/components/settings/IntegrationsConfigCard";

export default function IntegrationsCentralPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Plug className="h-5 w-5 text-cyan-500" />
              Central de Integrações
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie todas as integrações, webhooks e chaves de API
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-slate-500" />
              Acesso Rápido
            </CardTitle>
            <CardDescription>
              Navegue para configurações específicas de integrações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate('/settings/kiwify')}
              >
                <span className="text-orange-500">🛒</span>
                <span>Kiwify</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate('/settings/whatsapp')}
              >
                <span className="text-green-500">📱</span>
                <span>WhatsApp</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2"
                onClick={() => navigate('/settings/instagram')}
              >
                <span className="text-pink-500">📷</span>
                <span>Instagram</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <IntegrationsConfigCard />

        {/* Webhooks */}
        <WebhooksConfigCard />

        {/* Secrets */}
        <SecretsConfigCard />
      </main>
    </div>
  );
}
