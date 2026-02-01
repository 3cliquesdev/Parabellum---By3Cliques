import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Save, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface InstagramCredentials {
  app_id: string;
  app_secret: string;
  webhook_verify_token: string;
}

export default function InstagramCredentialsCard() {
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [credentials, setCredentials] = useState<InstagramCredentials>({
    app_id: "",
    app_secret: "",
    webhook_verify_token: "",
  });

  // Fetch integration status
  const { data: status, isLoading } = useQuery({
    queryKey: ["integration-status", "instagram"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("integration-status", {
        body: null,
        headers: { "Content-Type": "application/json" },
      });
      
      // Parse query param
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-status?provider=instagram`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch status");
      }
      
      return response.json();
    },
  });

  // Save credentials mutation
  const saveMutation = useMutation({
    mutationFn: async (creds: InstagramCredentials) => {
      const { data, error } = await supabase.functions.invoke("integration-encrypt", {
        body: {
          provider: "instagram",
          secrets: creds,
          public_config: {
            configured_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Credenciais do Instagram salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["integration-status", "instagram"] });
      setCredentials({ app_id: "", app_secret: "", webhook_verify_token: "" });
    },
    onError: (error) => {
      console.error("Error saving credentials:", error);
      toast.error("Erro ao salvar credenciais");
    },
  });

  const handleSave = () => {
    if (!credentials.app_id || !credentials.app_secret || !credentials.webhook_verify_token) {
      toast.error("Preencha todos os campos");
      return;
    }
    saveMutation.mutate(credentials);
  };

  const isConfigured = status?.is_configured || false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-pink-500">📷</span>
              Credenciais do Instagram
            </CardTitle>
            <CardDescription>
              Configure as credenciais do Meta/Facebook para a integração Instagram
            </CardDescription>
          </div>
          <Badge variant={isConfigured ? "default" : "secondary"} className="gap-1">
            {isConfigured ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Configurado
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                Não configurado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="app_id">Facebook App ID</Label>
              <Input
                id="app_id"
                placeholder="Ex: 1192784686401515"
                value={credentials.app_id}
                onChange={(e) => setCredentials({ ...credentials, app_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Encontrado em: Meta for Developers → Seu App → Configurações → Básico
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="app_secret">Facebook App Secret</Label>
              <div className="flex gap-2">
                <Input
                  id="app_secret"
                  type={showSecret ? "text" : "password"}
                  placeholder="Chave secreta do aplicativo"
                  value={credentials.app_secret}
                  onChange={(e) => setCredentials({ ...credentials, app_secret: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em "Mostrar" na página do Meta para copiar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify_token">Webhook Verify Token</Label>
              <div className="flex gap-2">
                <Input
                  id="verify_token"
                  type={showVerifyToken ? "text" : "password"}
                  placeholder="Token de verificação do webhook"
                  value={credentials.webhook_verify_token}
                  onChange={(e) => setCredentials({ ...credentials, webhook_verify_token: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowVerifyToken(!showVerifyToken)}
                >
                  {showVerifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O mesmo valor que você configura em: Meta → Webhooks → Editar → Token de verificação
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleSave} 
                disabled={saveMutation.isPending}
                className="flex-1"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Credenciais
              </Button>
              
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["integration-status", "instagram"] })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {isConfigured && status?.public_config?.configured_at && (
              <p className="text-xs text-muted-foreground text-center">
                Última configuração: {new Date(status.public_config.configured_at).toLocaleString("pt-BR")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
