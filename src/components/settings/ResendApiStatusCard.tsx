import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Key, Check, X, Loader2, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ResendApiStatusCard() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);

  const { data: apiStatus, refetch, isLoading } = useQuery({
    queryKey: ["resend-api-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resend-domain-manager", {
        body: { action: "test-api" },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      await refetch();
      toast({
        title: apiStatus?.valid ? "Conexão OK!" : "Conexão falhou",
        description: apiStatus?.valid 
          ? `API Resend funcionando. ${apiStatus.domainsCount} domínio(s) encontrado(s).`
          : apiStatus?.error || "Verifique sua API Key",
        variant: apiStatus?.valid ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao testar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isConfigured = apiStatus?.configured !== false;
  const isValid = apiStatus?.valid === true;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Status da API
            </CardTitle>
            <CardDescription>
              Conexão com o serviço de envio de emails
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Verificando...
              </Badge>
            ) : isValid ? (
              <Badge className="bg-green-500">
                <Check className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            ) : isConfigured ? (
              <Badge variant="destructive">
                <X className="h-3 w-3 mr-1" />
                Erro na conexão
              </Badge>
            ) : (
              <Badge variant="outline">
                <X className="h-3 w-3 mr-1" />
                Não configurado
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium">RESEND_API_KEY</span>
            </div>
            {isValid && apiStatus?.domainsCount !== undefined && (
              <p className="text-sm text-muted-foreground">
                {apiStatus.domainsCount} domínio(s) configurado(s)
              </p>
            )}
            {!isConfigured && (
              <p className="text-sm text-destructive">
                A chave de API não está configurada nas variáveis de ambiente
              </p>
            )}
            {isConfigured && !isValid && apiStatus?.error && (
              <p className="text-sm text-destructive">
                Erro: {apiStatus.error}
              </p>
            )}
          </div>
          <Button 
            variant="outline" 
            onClick={handleTestConnection}
            disabled={isTesting || isLoading}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Testar Conexão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
