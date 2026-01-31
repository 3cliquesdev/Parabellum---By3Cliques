import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Instagram, Loader2, CheckCircle2, XCircle, Eye, EyeOff, 
  Save, AlertTriangle, ExternalLink
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
    key: "FACEBOOK_APP_ID",
    label: "Facebook App ID",
    description: "ID do aplicativo Facebook/Instagram Business",
    placeholder: "Ex: 1192784686401515",
    type: "text",
  },
  {
    key: "FACEBOOK_APP_SECRET",
    label: "Facebook App Secret",
    description: "Chave secreta do aplicativo (obtida no Meta Developer Console)",
    placeholder: "Chave secreta...",
    type: "password",
  },
  {
    key: "INSTAGRAM_WEBHOOK_VERIFY_TOKEN",
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

  // Fetch current configuration status from system_configurations
  const { data: configStatus, isLoading } = useQuery({
    queryKey: ["instagram-secrets-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_configurations")
        .select("key, value")
        .in("key", INSTAGRAM_SECRETS.map(s => `instagram_${s.key.toLowerCase()}`));
      
      const status: Record<string, boolean> = {};
      INSTAGRAM_SECRETS.forEach(secret => {
        const configKey = `instagram_${secret.key.toLowerCase()}`;
        const config = data?.find(d => d.key === configKey);
        status[secret.key] = config?.value === "configured";
      });
      
      return status;
    },
    enabled: isAdmin,
  });

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async (secrets: Record<string, string>) => {
      const { data, error } = await supabase.functions.invoke("update-instagram-secrets", {
        body: { secrets },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-secrets-status"] });
      setEditedValues({});
      setIsEditing(false);
      toast({
        title: "Credenciais atualizadas",
        description: "As credenciais do Instagram foram salvas com sucesso. Pode levar alguns segundos para o deploy.",
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

  const configuredCount = Object.values(configStatus || {}).filter(Boolean).length;
  const allConfigured = configuredCount === INSTAGRAM_SECRETS.length;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram className="h-5 w-5 text-primary" />
          Credenciais Instagram Business
          {allConfigured ? (
            <Badge variant="default" className="ml-2">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {configuredCount}/{INSTAGRAM_SECRETS.length}
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
              const isConfigured = configStatus?.[secret.key];
              const showValue = showSecrets[secret.key];
              const currentValue = editedValues[secret.key] ?? "";

              return (
                <div key={secret.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={secret.key} className="flex items-center gap-2">
                      {isConfigured ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      {secret.label}
                    </Label>
                    <span className="text-xs text-muted-foreground font-mono">
                      {secret.key}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id={secret.key}
                      type={secret.type === "password" && !showValue ? "password" : "text"}
                      placeholder={isConfigured ? "••••••••••••••••" : secret.placeholder}
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

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://developers.facebook.com/apps", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Meta Developer Console
              </Button>

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

            <div className="rounded-lg border bg-muted/50 p-3 mt-4">
              <div className="flex gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Apenas para Super Admins</p>
                  <p>
                    Estas credenciais são sensíveis e controlam a integração com o Instagram. 
                    Alterações levam alguns segundos para entrar em vigor após o deploy automático.
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
