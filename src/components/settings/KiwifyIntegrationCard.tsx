import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Copy, ExternalLink, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function KiwifyIntegrationCard() {
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);

  // Buscar últimos eventos recebidos
  const { data: recentEvents, isLoading } = useQuery({
    queryKey: ["kiwify-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kiwify_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000, // Atualizar a cada 10 segundos
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kiwify-webhook`;

  const handleCopyUrl = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast({
        title: "✅ URL copiada!",
        description: "Cole no painel da Kiwify em Integrações → Webhooks",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Por favor, copie manualmente",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setCopying(false), 2000);
    }
  };

  const hasReceivedEvents = recentEvents && recentEvents.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-emerald-600" />
          Integração Kiwify
        </CardTitle>
        <CardDescription>
          Configure o webhook para sincronizar vendas automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL do Webhook */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            🔗 URL do Webhook
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="flex-1 px-3 py-2 text-sm bg-muted border border-input rounded-md font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyUrl}
              disabled={copying}
            >
              {copying ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open("https://kiwify.com.br/painel", "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Instruções */}
        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
          <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            📋 Como configurar na Kiwify:
          </h4>
          <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>1. Acesse <strong>kiwify.com.br</strong> → Meus Produtos</li>
            <li>2. Selecione o produto → <strong>Integrações</strong> → <strong>Webhooks</strong></li>
            <li>3. Cole a URL acima e selecione os eventos:</li>
            <li className="ml-4 space-y-1">
              <div>✓ <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">order_approved</code></div>
              <div>✓ <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">refunded</code></div>
              <div>✓ <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">chargedback</code></div>
              <div>✓ <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">subscription_renewed</code></div>
              <div>✓ <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">subscription_late</code></div>
              <div>✓ <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">subscription_card_declined</code></div>
              <div>✓ <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">subscription_canceled</code></div>
            </li>
            <li>4. Copie o <strong>Secret</strong> gerado e configure em "API Keys" acima</li>
          </ol>
        </div>

        {/* Status da Conexão */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            📊 Status da Conexão
          </label>
          
          {isLoading ? (
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Verificando...</span>
            </div>
          ) : hasReceivedEvents ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    ✅ Webhook Ativo
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Último evento: {new Date(recentEvents[0].created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Últimos Eventos */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Últimos 5 eventos:</p>
                <div className="space-y-1">
                  {recentEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                    >
                      <span className="font-mono text-muted-foreground">
                        {event.event_type}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(event.created_at).toLocaleTimeString('pt-BR')}
                      </span>
                      {event.processed ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : event.error_message ? (
                        <AlertTriangle className="h-3 w-3 text-rose-600" />
                      ) : (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  ⚠️ Nenhum evento recebido ainda
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Configure o webhook na Kiwify para começar
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Alerta sobre Secret */}
        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900">
          <p className="text-sm text-rose-900 dark:text-rose-100">
            <strong>⚠️ Importante:</strong> O Secret da Kiwify deve ser configurado em <strong>API Keys</strong> 
            com o nome <code className="bg-rose-100 dark:bg-rose-900 px-1 rounded">KIWIFY_WEBHOOK_SECRET</code> 
            para validação de segurança.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
