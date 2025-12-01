import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Copy, ExternalLink, CheckCircle2, AlertTriangle, Loader2, Plus, Trash2, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AddKiwifyTokenDialog from "./AddKiwifyTokenDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function KiwifyIntegrationCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copying, setCopying] = useState(false);
  const [addTokenDialogOpen, setAddTokenDialogOpen] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Buscar tokens cadastrados
  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ["kiwify-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kiwify_webhook_tokens")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

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

  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("kiwify_webhook_tokens")
        .delete()
        .eq("id", tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiwify-tokens"] });
      toast({
        title: "✅ Token removido",
        description: "Token excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover token",
        description: error.message,
        variant: "destructive",
      });
    },
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
  const activeTokensCount = tokens?.filter(t => t.is_active).length || 0;

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      // Payload de teste simulando uma venda da Kiwify
      const testPayload = {
        order_id: `TEST-${Date.now()}`,
        order_status: 'paid',
        Customer: {
          id: 'test-customer-id',
          full_name: 'Cliente Teste',
          email: 'teste@example.com',
          mobile_phone: '11999999999',
          CPF: '12345678900',
          Address: {
            street: 'Rua Teste',
            number: '123',
            neighborhood: 'Bairro Teste',
            city: 'São Paulo',
            state: 'SP',
            zipcode: '01234567'
          }
        },
        Product: {
          product_id: 'test-product-id',
          product_name: 'Produto Teste',
          offer_id: 'test-offer-id'
        },
        Commissions: {
          product_base_price: 100
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "✅ Webhook testado com sucesso",
          description: "Verifique a tabela de eventos abaixo",
        });
        queryClient.invalidateQueries({ queryKey: ["kiwify-events"] });
      } else {
        toast({
          title: "⚠️ Webhook respondeu com erro",
          description: result.error || "Verifique os logs do Edge Function",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "❌ Erro ao testar webhook",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            Integração Kiwify
          </CardTitle>
          <CardDescription>
            Configure os webhooks para sincronizar vendas automaticamente
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestWebhook}
              disabled={testingWebhook || activeTokensCount === 0}
              className="gap-2"
            >
              {testingWebhook ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  🧪 Testar Webhook
                </>
              )}
            </Button>
          </div>

          {/* Tokens Cadastrados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Key className="h-4 w-4" />
                Tokens Cadastrados ({activeTokensCount})
              </label>
              <Button
                size="sm"
                onClick={() => setAddTokenDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Token
              </Button>
            </div>

            {tokensLoading ? (
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg border">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Carregando tokens...</span>
              </div>
            ) : tokens && tokens.length > 0 ? (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      token.is_active
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
                        : "bg-muted/50 border-border"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{token.name}</p>
                        {token.is_active ? (
                          <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-full">
                            Ativo
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Token: {token.token.substring(0, 8)}...
                      </p>
                      {token.last_used_at && (
                        <p className="text-xs text-muted-foreground">
                          Último uso: {formatDistanceToNow(new Date(token.last_used_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTokenMutation.mutate(token.id)}
                      disabled={deleteTokenMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  ⚠️ Nenhum token cadastrado. Adicione os tokens gerados pela Kiwify.
                </p>
              </div>
            )}
          </div>

          {/* Instruções */}
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
              📋 Como configurar na Kiwify:
            </h4>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li>1. Acesse <strong>kiwify.com.br</strong> → Meus Produtos</li>
              <li>2. Selecione o produto → <strong>Integrações</strong> → <strong>Webhooks</strong></li>
              <li>3. Cole a URL acima e selecione os eventos</li>
              <li>4. Copie o <strong>Secret</strong> gerado e clique em "Adicionar Token" acima</li>
              <li>5. Cole o Secret e dê um nome (ex: "Produto X")</li>
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
        </CardContent>
      </Card>

      <AddKiwifyTokenDialog
        open={addTokenDialogOpen}
        onOpenChange={setAddTokenDialogOpen}
      />
    </>
  );
}
