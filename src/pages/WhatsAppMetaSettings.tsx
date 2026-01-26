import { useState } from "react";
import { 
  useWhatsAppMetaInstances, 
  useUpdateWhatsAppMetaToken, 
  useDiagnoseMetaInstance,
  DiagnosticResult 
} from "@/hooks/useWhatsAppMetaInstances";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Smartphone,
  Building2,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function WhatsAppMetaSettings() {
  const { data: instances, isLoading, refetch } = useWhatsAppMetaInstances();
  const updateToken = useUpdateWhatsAppMetaToken();
  const diagnose = useDiagnoseMetaInstance();
  
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const handleDiagnose = async (instanceId: string) => {
    setSelectedInstance(instanceId);
    const result = await diagnose.mutateAsync(instanceId);
    setDiagnosticResult(result);
  };

  const handleUpdateToken = async () => {
    if (!selectedInstance || !newToken.trim()) return;
    
    await updateToken.mutateAsync({ 
      instanceId: selectedInstance, 
      accessToken: newToken.trim() 
    });
    
    setIsUpdateDialogOpen(false);
    setNewToken("");
    setDiagnosticResult(null);
    
    // Re-run diagnostic after update
    setTimeout(() => handleDiagnose(selectedInstance), 1000);
  };

  const openUpdateDialog = (instanceId: string) => {
    setSelectedInstance(instanceId);
    setIsUpdateDialogOpen(true);
  };

  const maskToken = (token: string) => {
    if (!token) return "N/A";
    if (token.length <= 20) return "****";
    return `${token.substring(0, 12)}...${token.substring(token.length - 8)}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Meta API</h1>
          <p className="text-muted-foreground">
            Gerencie suas instâncias da API oficial do WhatsApp Cloud
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Instructions Card */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Como gerar um novo Access Token</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Se o token estiver expirado ou inválido, siga estes passos:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Acesse o <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta Business Suite → System Users</a></li>
            <li>Selecione o System User vinculado ao app WhatsApp</li>
            <li>Clique em <strong>Generate new token</strong></li>
            <li>Marque as permissões: <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code></li>
            <li>Defina expiração como <strong>Never</strong> (permanente)</li>
            <li>Copie o token e cole no campo abaixo</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Instances List */}
      <div className="space-y-4">
        {!instances || instances.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma instância Meta configurada.
            </CardContent>
          </Card>
        ) : (
          instances.map((instance) => (
            <Card key={instance.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-green-500" />
                    <div>
                      <CardTitle className="text-lg">{instance.name}</CardTitle>
                      <CardDescription>{instance.phone_number}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {diagnosticResult?.instance.id === instance.id ? (
                      diagnosticResult.token_valid ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" /> Token Válido
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> Token Inválido
                        </Badge>
                      )
                    ) : instance.webhook_verified ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Webhook Verificado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        Webhook Pendente
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Instance Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Key className="h-3 w-3" /> Phone Number ID
                    </p>
                    <p className="font-mono text-xs">{instance.phone_number_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Business Account ID
                    </p>
                    <p className="font-mono text-xs">{instance.business_account_id}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Última Atualização
                    </p>
                    <p className="text-xs">
                      {format(new Date(instance.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Token Preview */}
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">Access Token:</span>
                  <code className="text-xs flex-1">
                    {showToken ? instance.access_token : maskToken(instance.access_token)}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Diagnostic Results */}
                {diagnosticResult?.instance.id === instance.id && (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold text-sm">Resultado do Diagnóstico</h4>
                    
                    {diagnosticResult.phone_number && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Número:</span>{" "}
                        <span className="font-medium">{diagnosticResult.phone_number.display}</span>
                        {" - "}
                        <span className="text-muted-foreground">{diagnosticResult.phone_number.verified_name}</span>
                      </div>
                    )}
                    
                    {diagnosticResult.waba && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">WABA:</span>{" "}
                        <span className="font-medium">{diagnosticResult.waba.name}</span>
                        {" "}
                        <code className="text-xs bg-muted px-1 rounded">{diagnosticResult.waba.id}</code>
                      </div>
                    )}

                    {diagnosticResult.issues.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" /> Problemas Detectados:
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {diagnosticResult.issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {diagnosticResult.token_valid && diagnosticResult.issues.length === 0 && (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Tudo funcionando corretamente!
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDiagnose(instance.id)}
                    disabled={diagnose.isPending && selectedInstance === instance.id}
                  >
                    {diagnose.isPending && selectedInstance === instance.id ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Testar Conexão
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => openUpdateDialog(instance.id)}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Atualizar Token
                  </Button>
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto"
                  >
                    <Button variant="ghost" size="sm">
                      Meta Developers <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Update Token Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Access Token</DialogTitle>
            <DialogDescription>
              Cole o novo token gerado no Meta Business Suite. O token antigo será substituído.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo Access Token</label>
              <Input
                type="password"
                placeholder="EAAV..."
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O token deve começar com "EAAV" ou "EAA" e ter pelo menos 100 caracteres.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateToken}
              disabled={!newToken.trim() || newToken.length < 100 || updateToken.isPending}
            >
              {updateToken.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Salvar Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
