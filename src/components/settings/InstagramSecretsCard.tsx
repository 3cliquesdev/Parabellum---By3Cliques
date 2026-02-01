import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Instagram, Loader2, CheckCircle2, XCircle, Eye, EyeOff, 
  Save, AlertTriangle, ExternalLink, RefreshCcw
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

interface InstagramSecret {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  type: "text" | "password";
}

const INSTAGRAM_SECRETS: InstagramSecret[] = [
  {
    key: "app_id",
    label: "Facebook App ID",
    description: "ID do aplicativo Facebook/Instagram Business",
    placeholder: "Ex: 1192784686401515",
    type: "text",
  },
  {
    key: "app_secret",
    label: "Facebook App Secret",
    description: "Chave secreta do aplicativo (obtida no Meta Developer Console)",
    placeholder: "Chave secreta...",
    type: "password",
  },
  {
    key: "webhook_verify_token",
    label: "Webhook Verify Token",
    description: "Token usado para validar o webhook no Meta (você define esse valor)",
    placeholder: "Ex: meu_token_secreto_2026",
    type: "text",
  },
];

export default function InstagramSecretsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Fetch current configuration from integrations-get
  const { data: integration, isLoading, refetch } = useQuery({
    queryKey: ["instagram-integration-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("integrations-get", {
        body: null,
        method: "GET",
        headers: {},
      });

      // Use fetch directly since invoke doesn't support query params well
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integrations-get?provider=instagram`,
        {
          headers: {
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch integration status");
      }

      return response.json();
    },
    enabled: isAdmin,
  });

  // Save configuration mutation using integrations-set
  const saveMutation = useMutation({
    mutationFn: async (secrets: Record<string, string>) => {
      const { data, error } = await supabase.functions.invoke("integrations-set", {
        body: { 
          provider: "instagram",
          secrets,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-integration-status"] });
      setEditedValues({});
      setIsEditing(false);
      toast({
        title: "Credenciais atualizadas",
        description: "As credenciais do Instagram foram salvas e criptografadas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar as credenciais",
        variant: "destructive",
      });
    },
  });

  // Test configuration mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("integrations-test", {
        body: { provider: "instagram" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["instagram-integration-status"] });
      if (data.success) {
        toast({
          title: "Conexão válida",
          description: "As credenciais do Instagram estão funcionando corretamente.",
        });
      } else {
        toast({
          title: "Erro na validação",
          description: data.error || "As credenciais não são válidas",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao testar",
        description: error.message || "Não foi possível testar as credenciais",
        variant: "destructive",
      });
    },
  });

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
    if (!isEditing) setIsEditing(true);
  };

  const handleSave = () => {
    const secretsToSave = Object.fromEntries(
      Object.entries(editedValues).filter(([_, v]) => v.trim() !== "")
    );

    if (Object.keys(secretsToSave).length === 0) {
      toast({
        title: "Nenhuma alteração",
        description: "Preencha pelo menos um campo para salvar",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(secretsToSave);
  };

  // Only admins can see this card
  if (!isAdmin) {
    return null;
  }

  const isConfigured = integration?.is_configured || integration?.status === "active";
  const secretsMasked = integration?.secrets_masked || {};
  const hasAnySecret = Object.keys(secretsMasked).length > 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram className="h-5 w-5 text-primary" />
          Credenciais Instagram Business
          {isConfigured ? (
            <Badge variant="default" className="ml-2">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          ) : hasAnySecret ? (
            <Badge variant="secondary" className="ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Parcial
            </Badge>
          ) : (
            <Badge variant="destructive" className="ml-2">
              <XCircle className="h-3 w-3 mr-1" />
              Não Configurado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure as credenciais do Meta Developer Console para integração com Instagram
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {INSTAGRAM_SECRETS.map((secret) => {
              const maskedValue = secretsMasked[secret.key];
              const showValue = showSecrets[secret.key];
              const currentValue = editedValues[secret.key] ?? "";
              const hasValue = !!maskedValue;

              return (
                <div key={secret.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={secret.key} className="flex items-center gap-2">
                      {hasValue ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      {secret.label}
                    </Label>
                    <span className="text-xs text-muted-foreground font-mono uppercase">
                      {secret.key}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id={secret.key}
                      type={secret.type === "password" && !showValue ? "password" : "text"}
                      placeholder={hasValue ? maskedValue : secret.placeholder}
                      value={currentValue}
                      onChange={(e) => handleValueChange(secret.key, e.target.value)}
                      className="font-mono"
                    />
                    {secret.type === "password" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => toggleShowSecret(secret.key)}
                      >
                        {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{secret.description}</p>
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-4 border-t gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://developers.facebook.com/apps", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Meta Developer Console
              </Button>

              <div className="flex gap-2">
                {isConfigured && (
                  <Button
                    variant="outline"
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-4 w-4 mr-2" />
                    )}
                    Testar
                  </Button>
                )}

                <Button
                  onClick={handleSave}
                  disabled={!isEditing || saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Credenciais
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 p-3 mt-4">
              <div className="flex gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Apenas para Super Admins</p>
                  <p>
                    Estas credenciais são sensíveis e controlam a integração com o Instagram. 
                    São armazenadas com criptografia AES-256 e nunca expostas em texto plano.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
