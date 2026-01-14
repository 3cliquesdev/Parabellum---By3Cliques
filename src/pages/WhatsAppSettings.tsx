import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Smartphone, Settings, Trash2, QrCode, AlertTriangle, Zap, Activity, RefreshCw, Webhook, Stethoscope, Inbox, Send, Bot, Sparkles, BotOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUpdateWhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { toast } from "sonner";
import { useWhatsAppInstances, useDeleteWhatsAppInstance, useConnectWhatsAppInstance, useResetWhatsAppInstance, useWhatsAppAPIStatus } from "@/hooks/useWhatsAppInstances";
import { useTestWhatsAppConnection } from "@/hooks/useTestWhatsAppConnection";
import { useSyncWhatsAppInstances } from "@/hooks/useSyncWhatsAppInstances";
import { useReconfigureWebhook, useTestWebhook } from "@/hooks/useWhatsAppWebhook";
import { WhatsAppInstanceDialog } from "@/components/WhatsAppInstanceDialog";
import { QRCodeModal } from "@/components/QRCodeModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAIGlobalConfig } from "@/hooks/useAIGlobalConfig";

export default function WhatsAppSettings() {
  const { data: instances, isLoading } = useWhatsAppInstances();
  const deleteMutation = useDeleteWhatsAppInstance();
  const connectMutation = useConnectWhatsAppInstance();
  const resetMutation = useResetWhatsAppInstance();
  const testConnectionMutation = useTestWhatsAppConnection();
  const syncMutation = useSyncWhatsAppInstances();
  const reconfigureWebhookMutation = useReconfigureWebhook();
  const testWebhookMutation = useTestWebhook();
  const updateMutation = useUpdateWhatsAppInstance();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [webhookDiagnostics, setWebhookDiagnostics] = useState<any>(null);
  const { isAIEnabled } = useAIGlobalConfig();
  // API Status for first instance (for demonstration)
  const firstInstance = instances?.[0];
  const { data: apiStatus } = useWhatsAppAPIStatus(
    firstInstance?.api_url || '',
    firstInstance?.api_token || ''
  );

  const handleEdit = (instance: any) => {
    setSelectedInstance(instance);
    setDialogOpen(true);
  };

  const handleConnect = async (instance: any) => {
    try {
      await connectMutation.mutateAsync(instance.id);
      setSelectedInstance(instance);
      setQrModalOpen(true);
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover esta instância?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleHardReset = async (instance: any) => {
    if (confirm("⚠️ RESET FORÇADO\n\nIsso vai:\n1. Desconectar (logout)\n2. Deletar a instância na API\n3. Limpar status no banco\n\nConfirma?")) {
      await resetMutation.mutateAsync(instance.id);
    }
  };

  const handleTestConnection = async (instance: any) => {
    setTestResult(null);
    const result = await testConnectionMutation.mutateAsync({
      instance_id: instance.id,
    });
    setTestResult({ ...result, instanceId: instance.id });
  };

  const handleNewInstance = () => {
    setSelectedInstance(null);
    setDialogOpen(true);
  };

  const handleSync = async () => {
    await syncMutation.mutateAsync();
  };

  const handleReconfigureWebhook = async (instance: any) => {
    setWebhookDiagnostics(null);
    await reconfigureWebhookMutation.mutateAsync(instance.id);
  };

  const handleTestWebhook = async (instance: any) => {
    const result = await testWebhookMutation.mutateAsync(instance.id);
    setWebhookDiagnostics({ ...result, instanceId: instance.id });
  };

  const handleToggleInbox = async (instanceId: string, enabled: boolean) => {
    try {
      await updateMutation.mutateAsync({ id: instanceId, inbox_enabled: enabled });
      toast.success(
        enabled 
          ? "📥 Inbox habilitado - mensagens serão recebidas" 
          : "📤 Inbox desabilitado - apenas envio"
      );
    } catch (error) {
      toast.error("Erro ao atualizar configuração");
    }
  };

  const getStatusIndicator = () => {
    if (!apiStatus) return null;
    
    switch (apiStatus.status) {
      case 'online':
        return (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            API Online ({apiStatus.latency}ms)
          </div>
        );
      case 'slow':
        return (
          <div className="flex items-center gap-2 text-yellow-600 text-sm">
            <AlertTriangle className="w-3 h-3" />
            Alta Latência ({apiStatus.latency}ms)
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle className="w-3 h-3" />
            API Offline
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">Conectado</Badge>;
      case 'qr_pending':
        return <Badge variant="secondary">Aguardando QR</Badge>;
      default:
        return <Badge variant="destructive">Desconectado</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestão de WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure instâncias WhatsApp com Evolution API
          </p>
          {getStatusIndicator()}
          {/* Webhook URL Display */}
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              🔗 URL do Webhook (configurada automaticamente):
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded border flex-1 font-mono">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-whatsapp-event
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-whatsapp-event`
                  );
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar com API'}
          </Button>
          <Button onClick={handleNewInstance}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Instância
          </Button>
        </div>
      </div>

      {/* API Status Warning */}
      {apiStatus?.status === 'offline' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ API Evolution inacessível ou offline. Certifique-se de que a URL é pública (HTTPS) e não localhost.
          </AlertDescription>
        </Alert>
      )}

      {apiStatus?.status === 'slow' && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            ⚠️ Alta latência detectada ({apiStatus.latency}ms). A conexão pode estar lenta.
          </AlertDescription>
        </Alert>
      )}

      {/* Test Result Display */}
      {testResult && !testResult.success && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-semibold">
            {testResult.errorType === 'cors' && '🚫 Bloqueio de CORS'}
            {testResult.errorType === 'mixed_content' && '🔒 Bloqueio de Mixed Content (HTTPS → HTTP)'}
            {testResult.errorType === 'auth' && '🔑 Token de API Inválido'}
            {testResult.errorType === 'not_found' && '❌ Endpoint Não Encontrado'}
            {testResult.errorType === 'timeout' && '⏱️ Timeout de Conexão'}
            {testResult.errorType === 'network' && '🌐 Erro de Rede'}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p className="font-medium">{testResult.errorMessage}</p>
            <p className="text-sm opacity-90">{testResult.technicalDetails}</p>
            {testResult.errorType === 'mixed_content' && (
              <div className="mt-3 p-3 bg-destructive/10 rounded border border-destructive/20">
                <p className="text-xs font-semibold">✅ Solução:</p>
                <p className="text-xs mt-1">Configure SSL/HTTPS na sua Evolution API. A maioria dos servidores VPS oferece certificados gratuitos via Let's Encrypt.</p>
              </div>
            )}
            {testResult.errorType === 'cors' && (
              <div className="mt-3 p-3 bg-destructive/10 rounded border border-destructive/20">
                <p className="text-xs font-semibold">✅ Solução:</p>
                <p className="text-xs mt-1">Adicione no .env da Evolution API:</p>
                <code className="text-xs block mt-1 bg-black/20 p-2 rounded">
                  CORS_ORIGIN=*<br/>
                  CORS_METHODS=POST,GET,PUT,DELETE<br/>
                  CORS_CREDENTIALS=true
                </code>
                <p className="text-xs mt-1">Depois reinicie o serviço.</p>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {testResult && testResult.success && (
        <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <Activity className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-300">
            ✅ Conexão OK
          </AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-400">
            API respondeu com sucesso em {testResult.latency}ms
          </AlertDescription>
        </Alert>
      )}

      {/* Webhook Diagnostics Display */}
      {webhookDiagnostics && (
        <Alert 
          variant={webhookDiagnostics.overallStatus === "fail" ? "destructive" : "default"}
          className={webhookDiagnostics.overallStatus === "pass" ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : ""}
        >
          <Stethoscope className="h-4 w-4" />
          <AlertTitle className="font-semibold">
            {webhookDiagnostics.overallStatus === "pass" ? "✅" : webhookDiagnostics.overallStatus === "warn" ? "⚠️" : "❌"} Diagnóstico do Webhook
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p className="font-medium">{webhookDiagnostics.summary}</p>
            <div className="space-y-2 text-sm">
              {webhookDiagnostics.checks?.map((check: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-background/50 rounded border">
                  <span>
                    {check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : check.status === "fail" ? "❌" : "ℹ️"}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{check.name}</p>
                    {check.details && (
                      <pre className="text-xs mt-1 text-muted-foreground overflow-x-auto">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWebhookDiagnostics(null)}
            >
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Instances Table */}
      <Card>
        {isLoading ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Carregando instâncias...</p>
          </div>
        ) : instances && instances.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modo IA</TableHead>
                <TableHead>Inbox</TableHead>
                <TableHead>Vinculação</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((instance: any) => (
                <TableRow key={instance.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{instance.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {instance.phone_number || (
                      <span className="text-muted-foreground text-sm">
                        Não conectado
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(instance.status)}</TableCell>
                  <TableCell>
                    {!isAIEnabled ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        <BotOff className="h-3 w-3 mr-1" />
                        IA Global OFF
                      </Badge>
                    ) : instance.ai_mode === 'autopilot' ? (
                      <Badge className="bg-green-600">
                        <Bot className="h-3 w-3 mr-1" />
                        Autopilot
                      </Badge>
                    ) : instance.ai_mode === 'copilot' ? (
                      <Badge variant="secondary" className="bg-blue-600 text-white">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Copilot
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <BotOff className="h-3 w-3 mr-1" />
                        Desligado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={instance.inbox_enabled !== false}
                        onCheckedChange={(checked) => handleToggleInbox(instance.id, checked)}
                      />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {instance.inbox_enabled !== false ? (
                          <>
                            <Inbox className="w-3 h-3" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            Só envio
                          </>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {instance.user ? (
                        <Badge variant="default" className="text-xs bg-green-600">
                          👤 Dono: {instance.user.full_name}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          🏢 Geral
                        </Badge>
                      )}
                      {instance.department && (
                        <Badge variant="outline" className="text-xs">
                          📁 {instance.department.name}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleTestConnection(instance)}>
                          <Activity className="w-4 h-4 mr-2" />
                          🔍 Testar Conexão API
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleTestWebhook(instance)}
                          disabled={testWebhookMutation.isPending}
                        >
                          <Stethoscope className="w-4 h-4 mr-2" />
                          🩺 Diagnosticar Webhook
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleReconfigureWebhook(instance)}
                          disabled={reconfigureWebhookMutation.isPending}
                        >
                          <Webhook className="w-4 h-4 mr-2" />
                          🔧 Reconfigurar Webhook
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {instance.status !== 'connected' && (
                          <DropdownMenuItem onClick={() => handleConnect(instance)}>
                            <QrCode className="w-4 h-4 mr-2" />
                            Conectar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleEdit(instance)}>
                          <Settings className="w-4 h-4 mr-2" />
                          Configurar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleHardReset(instance)}
                          className="text-orange-600"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          🔄 Reset Forçado
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(instance.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center space-y-4">
            <Smartphone className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">
                Nenhuma instância configurada
              </p>
              <p className="text-sm text-muted-foreground">
                Crie sua primeira instância WhatsApp para começar
              </p>
            </div>
            <Button onClick={handleNewInstance}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Instância
            </Button>
          </div>
        )}
      </Card>

      <WhatsAppInstanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        instance={selectedInstance}
      />

      {selectedInstance && (
        <QRCodeModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          instance={instances?.find((i: any) => i.id === selectedInstance.id) || selectedInstance}
        />
      )}
    </div>
  );
}
