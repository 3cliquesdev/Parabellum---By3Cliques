import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Copy, ExternalLink, CheckCircle2, AlertTriangle, Loader2, Plus, Trash2, Key, RefreshCw, Settings, History, Clock, Users, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AddKiwifyTokenDialog from "./AddKiwifyTokenDialog";
import SyncOptionsDialog, { SyncOptions } from "./SyncOptionsDialog";
import SyncProgressWidget from "./SyncProgressWidget";
import SyncReportDialog from "./SyncReportDialog";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function KiwifyIntegrationCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copying, setCopying] = useState(false);
  const [addTokenDialogOpen, setAddTokenDialogOpen] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [syncOptionsOpen, setSyncOptionsOpen] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [syncReportOpen, setSyncReportOpen] = useState(false);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [apiConfigOpen, setApiConfigOpen] = useState(false);
  const [syncHistoryOpen, setSyncHistoryOpen] = useState(false);
  
  // Estado para importação de contatos
  const [importContactsOpen, setImportContactsOpen] = useState(false);
  const [importDaysBack, setImportDaysBack] = useState("365");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  
  const [apiCredentials, setApiCredentials] = useState({
    client_id: "",
    client_secret: "",
    account_id: "",
  });
  const [initialized, setInitialized] = useState(false);

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

  // Buscar credenciais da API
  const { data: apiConfigs } = useQuery({
    queryKey: ["kiwify-api-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("key, value")
        .in("key", ["kiwify_client_id", "kiwify_client_secret", "kiwify_account_id"]);
      
      if (error) throw error;
      
      const configs: any = {};
      data?.forEach(c => {
        const key = c.key.replace("kiwify_", "");
        configs[key] = c.value;
      });
      
      return configs;
    },
  });

  // Sincronizar estado apenas na primeira carga
  useEffect(() => {
    if (apiConfigs && !initialized) {
      setApiCredentials({
        client_id: apiConfigs.client_id || "",
        client_secret: apiConfigs.client_secret || "",
        account_id: apiConfigs.account_id || "",
      });
      setInitialized(true);
    }
  }, [apiConfigs, initialized]);

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

  // Buscar última sincronização
  const { data: lastSync } = useQuery({
    queryKey: ["kiwify-last-sync"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_jobs")
        .select("*")
        .eq("job_type", "kiwify_sales")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Buscar histórico completo de sincronizações
  const { data: syncHistory } = useQuery({
    queryKey: ["kiwify-sync-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_jobs")
        .select("*")
        .eq("job_type", "kiwify_sales")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
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

  const saveApiConfigsMutation = useMutation({
    mutationFn: async () => {
      // Validação: Verificar se todos os campos estão preenchidos
      if (!apiCredentials.client_id?.trim() || 
          !apiCredentials.client_secret?.trim() || 
          !apiCredentials.account_id?.trim()) {
        throw new Error("Preencha todos os campos (Client ID, Client Secret e Account ID)");
      }

      const updates = [
        { key: "kiwify_client_id", value: apiCredentials.client_id.trim() },
        { key: "kiwify_client_secret", value: apiCredentials.client_secret.trim() },
        { key: "kiwify_account_id", value: apiCredentials.account_id.trim() },
      ];

      for (const config of updates) {
        const { error } = await supabase
          .from("system_configurations")
          .upsert(
            {
              key: config.key,
              value: config.value,
              category: "integration",
              description: `Kiwify API ${config.key.replace("kiwify_", "")}`,
            },
            { onConflict: "key" }
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiwify-api-configs"] });
      toast({
        title: "✅ Configurações salvas",
        description: "Credenciais da API Kiwify atualizadas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar configurações",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSyncKiwifySales = async (options: SyncOptions) => {
    setSyncOptionsOpen(false);
    
    // Mostrar feedback imediato
    toast({
      title: "Sincronização iniciada",
      description: "A importação de vendas está em andamento...",
    });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("sync-kiwify-sales", {
        body: {
          ...options,
          user_id: user?.id,
        },
      });

      if (error) {
        toast({
          title: "❌ Erro na Sincronização",
          description: error.message || "Falha ao sincronizar vendas da Kiwify",
          variant: "destructive",
        });
        throw error;
      }
      
      if (data?.error) {
        toast({
          title: "❌ Erro na Sincronização",
          description: data.error || "Falha ao sincronizar vendas da Kiwify",
          variant: "destructive",
        });
        return;
      }

      // Iniciar tracking do job
      setCurrentJobId(data.job_id);

      // Quando job completar, mostrar relatório
      const checkJobCompletion = setInterval(async () => {
        const { data: job } = await supabase
          .from("sync_jobs")
          .select("*")
          .eq("id", data.job_id)
          .single();

        if (job && (job.status === "completed" || job.status === "failed")) {
          clearInterval(checkJobCompletion);
          setCurrentJobId(null);
          
          // Invalidar cache de sincronização
          queryClient.invalidateQueries({ queryKey: ["kiwify-last-sync"] });
          queryClient.invalidateQueries({ queryKey: ["kiwify-sync-history"] });
          
          if (job.status === "completed") {
            setSyncStats({
              total_sales: job.processed_items,
              contacts_created: job.contacts_created,
              contacts_updated: job.updated_items,
              auth_users_created: job.auth_users_created,
              deals_created: job.deals_created,
              deals_updated: job.deals_updated,
              errors: Array.isArray(job.errors) ? job.errors.length : 0,
            });
            setSyncReportOpen(true);
            queryClient.invalidateQueries({ queryKey: ["kiwify-financials"] });
          } else {
            toast({
              title: "❌ Sincronização falhou",
              description: "Verifique os logs para mais detalhes",
              variant: "destructive",
            });
          }
        }
      }, 2000);

    } catch (error: any) {
      toast({
        title: "❌ Erro ao iniciar sincronização",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Função para importar apenas contatos (sem deals)
  const handleImportContacts = async () => {
    setImportContactsOpen(false);
    setImportingContacts(true);
    
    toast({
      title: "Importação iniciada",
      description: "Importando apenas contatos PAID (sem deals)...",
    });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("import-kiwify-contacts", {
        body: {
          days_back: parseInt(importDaysBack),
          update_existing: updateExisting,
          user_id: user?.id,
        },
      });

      if (error) {
        toast({
          title: "❌ Erro na Importação",
          description: error.message || "Falha ao importar contatos da Kiwify",
          variant: "destructive",
        });
        setImportingContacts(false);
        return;
      }
      
      if (data?.error) {
        toast({
          title: "❌ Erro na Importação",
          description: data.error || "Falha ao importar contatos da Kiwify",
          variant: "destructive",
        });
        setImportingContacts(false);
        return;
      }

      // Iniciar tracking do job
      setImportJobId(data.job_id);

      // Quando job completar, mostrar relatório
      const checkJobCompletion = setInterval(async () => {
        const { data: job } = await supabase
          .from("sync_jobs")
          .select("*")
          .eq("id", data.job_id)
          .single();

        if (job && (job.status === "completed" || job.status === "failed")) {
          clearInterval(checkJobCompletion);
          setImportJobId(null);
          setImportingContacts(false);
          
          queryClient.invalidateQueries({ queryKey: ["kiwify-last-sync"] });
          queryClient.invalidateQueries({ queryKey: ["kiwify-sync-history"] });
          
          if (job.status === "completed") {
            toast({
              title: "✅ Importação Concluída",
              description: `${job.contacts_created || 0} contatos criados, ${job.updated_items || 0} atualizados`,
            });
          } else {
            toast({
              title: "❌ Importação falhou",
              description: "Verifique os logs para mais detalhes",
              variant: "destructive",
            });
          }
        }
      }, 2000);

    } catch (error: any) {
      toast({
        title: "❌ Erro ao iniciar importação",
        description: error.message,
        variant: "destructive",
      });
      setImportingContacts(false);
    }
  };

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
      const activeToken = tokens?.find((t) => t.is_active)?.token;
      if (!activeToken) {
        toast({
          title: "Nenhum token ativo",
          description: "Cadastre e ative um token antes de testar o webhook",
          variant: "destructive",
        });
        return;
      }

      // Payload de teste simulando uma venda da Kiwify
      const testPayload = {
        order_id: `TEST-${Date.now()}`,
        order_status: "paid",
        Customer: {
          id: "test-customer-id",
          full_name: "Cliente Teste",
          email: "teste@example.com",
          mobile_phone: "11999999999",
          CPF: "12345678900",
          Address: {
            street: "Rua Teste",
            number: "123",
            neighborhood: "Bairro Teste",
            city: "São Paulo",
            state: "SP",
            zipcode: "01234567",
          },
        },
        Product: {
          product_id: "test-product-id",
          product_name: "Produto Teste",
          offer_id: "test-offer-id",
        },
        Commissions: {
          product_base_price: 100,
        },
      };

      // Precisamos usar EXACTAMENTE o mesmo body para assinar e enviar
      const bodyText = JSON.stringify(testPayload);

      // Gerar assinatura HMAC SHA-1 igual à Kiwify usando o token ativo
      const encoder = new TextEncoder();
      const keyData = encoder.encode(activeToken);
      const messageData = encoder.encode(bodyText);

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
      );

      const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
      const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const url = new URL(webhookUrl);
      url.searchParams.set("signature", signatureHex);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: bodyText,
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

      {/* Card Separado para API Kiwify */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            API Kiwify (Sincronização)
          </CardTitle>
          <CardDescription>
            Configure credenciais da API para sincronizar vendas históricas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Collapsible open={apiConfigOpen} onOpenChange={setApiConfigOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {apiConfigs?.client_id ? "Credenciais Configuradas ✅" : "Configurar Credenciais"}
                </span>
                <Settings className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client ID</Label>
                <Input
                  id="client_id"
                  type="text"
                  value={apiCredentials.client_id}
                  onChange={(e) => setApiCredentials({ ...apiCredentials, client_id: e.target.value })}
                  placeholder="Seu Client ID da Kiwify"
                  className={!apiCredentials.client_id?.trim() ? "border-rose-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_secret">Client Secret</Label>
                <Input
                  id="client_secret"
                  type="password"
                  value={apiCredentials.client_secret}
                  onChange={(e) => setApiCredentials({ ...apiCredentials, client_secret: e.target.value })}
                  placeholder="Seu Client Secret da Kiwify"
                  className={!apiCredentials.client_secret?.trim() ? "border-rose-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_id">Account ID</Label>
                <Input
                  id="account_id"
                  type="text"
                  value={apiCredentials.account_id}
                  onChange={(e) => setApiCredentials({ ...apiCredentials, account_id: e.target.value })}
                  placeholder="Seu Account ID da Kiwify"
                  className={!apiCredentials.account_id?.trim() ? "border-rose-500" : ""}
                />
              </div>
              
              {(!apiCredentials.client_id?.trim() || 
                !apiCredentials.client_secret?.trim() || 
                !apiCredentials.account_id?.trim()) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                  <p className="text-xs text-amber-900 dark:text-amber-100">
                    ⚠️ Preencha todos os campos para salvar as credenciais
                  </p>
                </div>
              )}

              <Button
                onClick={() => saveApiConfigsMutation.mutate()}
                disabled={
                  !apiCredentials.client_id?.trim() || 
                  !apiCredentials.client_secret?.trim() || 
                  !apiCredentials.account_id?.trim() ||
                  saveApiConfigsMutation.isPending
                }
                className="w-full"
              >
                {saveApiConfigsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Credenciais"
                )}
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Histórico de Sincronização */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de Sincronização
              </label>
              {syncHistory && syncHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSyncHistoryOpen(true)}
                  className="gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Ver Histórico Completo
                </Button>
              )}
            </div>

            {!lastSync ? (
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground text-center">
                  📭 Nenhuma sincronização realizada ainda
                </p>
              </div>
            ) : lastSync.status === "running" ? (
              <SyncProgressWidget jobId={lastSync.id} />
            ) : lastSync.status === "completed" ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                      ✅ Última sincronização bem-sucedida
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      {format(new Date(lastSync.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - {lastSync.processed_items || 0} vendas importadas
                    </p>
                    {lastSync.contacts_created > 0 && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {lastSync.contacts_created} contatos criados, {lastSync.deals_created || 0} negócios criados
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
                      ❌ Última tentativa falhou
                    </p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                      {format(new Date(lastSync.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {lastSync.errors && Array.isArray(lastSync.errors) && lastSync.errors.length > 0 && (
                      <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                        {(lastSync.errors[0] as any)?.message || "Erro desconhecido"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Botões de Ação */}
          <div className="space-y-4">
            {/* Importar Apenas Contatos (NOVO) */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    Importar Apenas Contatos (Paid)
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    Importa clientes com vendas pagas, sem criar deals. Ideal para cadastrar clientes antigos.
                  </p>
                  {importJobId ? (
                    <SyncProgressWidget jobId={importJobId} />
                  ) : (
                    <Button
                      onClick={() => setImportContactsOpen(true)}
                      disabled={!apiConfigs?.client_id || importingContacts}
                      className="mt-3 gap-2"
                      variant="outline"
                      size="sm"
                    >
                      {importingContacts ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Importar Apenas Contatos
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Sincronizar Vendas (existente) */}
            {currentJobId ? (
              <SyncProgressWidget jobId={currentJobId} />
            ) : (
              <Button
                onClick={() => setSyncOptionsOpen(true)}
                disabled={!apiConfigs?.client_id || lastSync?.status === 'running'}
                className="w-full gap-2"
                size="lg"
              >
                {lastSync?.status === 'running' ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    🔄 Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5" />
                    🔄 Importar Todas as Vendas (com Deals)
                  </>
                )}
              </Button>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {!apiConfigs?.client_id
                ? "⚠️ Configure as credenciais da API antes de sincronizar"
                : lastSync?.status === 'running' 
                ? "⏳ Sincronização em andamento..."
                : "Importa vendas + cria deals no pipeline"}
            </p>
          </div>

          {/* Instruções */}
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
              📋 Como obter as credenciais:
            </h4>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li>1. Acesse <strong>kiwify.com.br/painel</strong> → Configurações</li>
              <li>2. Vá em <strong>API</strong> → <strong>Gerar Credenciais OAuth</strong></li>
              <li>3. Copie o <strong>Client ID</strong>, <strong>Client Secret</strong> e <strong>Account ID</strong></li>
              <li>4. Cole os valores acima e clique em "Salvar Credenciais"</li>
              <li>5. Clique em "Sincronizar Vendas" para importar histórico</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <AddKiwifyTokenDialog
        open={addTokenDialogOpen}
        onOpenChange={setAddTokenDialogOpen}
      />

      <SyncOptionsDialog
        open={syncOptionsOpen}
        onOpenChange={setSyncOptionsOpen}
        onConfirm={handleSyncKiwifySales}
        isLoading={!!currentJobId}
      />

      <SyncReportDialog
        open={syncReportOpen}
        onOpenChange={setSyncReportOpen}
        stats={syncStats || {
          total_sales: 0,
          contacts_created: 0,
          contacts_updated: 0,
          auth_users_created: 0,
          deals_created: 0,
          deals_updated: 0,
          errors: 0,
        }}
      />

      {/* Dialog de Histórico Completo */}
      <Dialog open={syncHistoryOpen} onOpenChange={setSyncHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico Completo de Sincronizações
            </DialogTitle>
            <DialogDescription>
              Últimas 20 tentativas de sincronização com a Kiwify
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {syncHistory && syncHistory.length > 0 ? (
              syncHistory.map((job) => (
                <div
                  key={job.id}
                  className={`p-4 rounded-lg border ${
                    job.status === "completed"
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
                      : job.status === "failed"
                      ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                      : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {job.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                      ) : job.status === "failed" ? (
                        <AlertTriangle className="h-5 w-5 text-rose-600 mt-0.5" />
                      ) : (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {job.status === "completed"
                              ? "✅ Sincronização bem-sucedida"
                              : job.status === "failed"
                              ? "❌ Sincronização falhou"
                              : "🔄 Sincronização em andamento"}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(job.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                        {job.status === "completed" && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs">
                              📊 <strong>{job.processed_items || 0}</strong> vendas processadas
                            </p>
                            {job.contacts_created > 0 && (
                              <p className="text-xs">
                                👤 <strong>{job.contacts_created}</strong> contatos criados
                              </p>
                            )}
                            {job.deals_created > 0 && (
                              <p className="text-xs">
                                💼 <strong>{job.deals_created}</strong> negócios criados
                              </p>
                            )}
                          </div>
                        )}
                        {job.status === "failed" && job.errors && Array.isArray(job.errors) && job.errors.length > 0 && (
                          <p className="text-xs text-rose-700 dark:text-rose-300 mt-2">
                            {(job.errors[0] as any)?.message || "Erro desconhecido"}
                          </p>
                        )}
                        {job.status === "running" && (
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                            {job.processed_items || 0} itens processados...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  📭 Nenhuma sincronização encontrada
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Importação de Contatos */}
      <Dialog open={importContactsOpen} onOpenChange={setImportContactsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Importar Apenas Contatos
            </DialogTitle>
            <DialogDescription>
              Importa clientes com vendas PAID diretamente para a base de contatos, sem criar deals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Período de importação</Label>
              <Select value={importDaysBack} onValueChange={setImportDaysBack}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 6 meses</SelectItem>
                  <SelectItem value="365">Último 1 ano</SelectItem>
                  <SelectItem value="730">Últimos 2 anos</SelectItem>
                  <SelectItem value="1095">Últimos 3 anos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-existing"
                checked={updateExisting}
                onCheckedChange={(checked) => setUpdateExisting(checked === true)}
              />
              <Label htmlFor="update-existing" className="text-sm font-normal">
                Atualizar contatos existentes (telefone, documento, etc.)
              </Label>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
              <p className="text-xs text-amber-900 dark:text-amber-100">
                ⚠️ <strong>Importante:</strong> Esta importação cria APENAS contatos. Nenhum deal será criado. 
                Use para cadastrar clientes antigos que não estão na base.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setImportContactsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImportContacts} className="gap-2">
                <Download className="h-4 w-4" />
                Iniciar Importação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
