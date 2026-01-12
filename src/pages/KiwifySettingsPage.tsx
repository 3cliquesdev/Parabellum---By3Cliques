import { ArrowLeft, ShoppingCart, Package, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import KiwifyIntegrationCard from "@/components/settings/KiwifyIntegrationCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function KiwifySettingsPage() {
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
              <ShoppingCart className="h-5 w-5 text-orange-500" />
              Integração Kiwify
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure webhooks, tokens e sincronização com a Kiwify
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Main Integration Card */}
        <KiwifyIntegrationCard />

        {/* Additional Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Automações Kiwify
            </CardTitle>
            <CardDescription>
              Configure ações automáticas baseadas em eventos da Kiwify
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium">Grupos de Entrega</p>
                  <p className="text-sm text-muted-foreground">
                    Automatize entregas baseadas em compras
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate('/settings/delivery-groups')}>
                Configurar
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
