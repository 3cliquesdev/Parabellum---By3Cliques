import { useState } from "react";
import { useInstagramAccounts, useConnectInstagram, useDisconnectInstagram, useSyncInstagram } from "@/hooks/instagram";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Instagram, 
  Link2, 
  Unlink, 
  RefreshCw, 
  Webhook, 
  Bell,
  Copy,
  Check,
  AlertCircle,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const InstagramSettings = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  const { data: accounts, isLoading } = useInstagramAccounts();
  const { startOAuth } = useConnectInstagram();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectInstagram();
  const { mutate: syncNow, isPending: isSyncing } = useSyncInstagram();

  const activeAccount = accounts?.find((a) => a.is_active);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-webhook`;

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: "URL copiada!", description: "Cole no Meta Developer Console" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    if (!activeAccount) return;
    if (window.confirm("Tem certeza que deseja desconectar esta conta?")) {
      disconnect(activeAccount.id);
    }
  };

  const handleSync = () => {
    if (!activeAccount) return;
    syncNow(activeAccount.id);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Connect Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Conectar Conta Instagram
          </CardTitle>
          <CardDescription>
            Conecte sua conta Instagram Business para receber comentários e mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse h-20 bg-muted rounded-lg" />
          ) : activeAccount ? (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={activeAccount.profile_picture_url || undefined} />
                  <AvatarFallback>
                    {activeAccount.username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">@{activeAccount.username}</p>
                  <p className="text-sm text-muted-foreground">
                    {activeAccount.followers_count?.toLocaleString()} seguidores
                  </p>
                  <Badge variant="default" className="mt-1">
                    <Check className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                <Unlink className="h-4 w-4 mr-2" />
                {isDisconnecting ? "Desconectando..." : "Desconectar"}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <Instagram className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Nenhuma conta conectada
              </p>
              <Button onClick={startOAuth}>
                <Link2 className="h-4 w-4 mr-2" />
                Conectar Instagram Business
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Configuração de Webhooks
          </CardTitle>
          <CardDescription>
            Configure webhooks no Meta Developer para receber eventos em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Para receber comentários e mensagens em tempo real, configure este webhook no{" "}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Meta Developer Console
              </a>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Eventos inscritos:</span>
            <Badge variant="outline">comments</Badge>
            <Badge variant="outline">messages</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Synchronization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronização
          </CardTitle>
          <CardDescription>
            Sincronize posts e comentários manualmente ou configure sincronização automática
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Última sincronização</p>
              <p className="text-sm text-muted-foreground">
                {activeAccount?.last_sync_at ? (
                  <>
                    <Clock className="inline h-3 w-3 mr-1" />
                    {formatDistanceToNow(new Date(activeAccount.last_sync_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </>
                ) : (
                  "Nunca sincronizado"
                )}
              </p>
            </div>
            <Button
              onClick={handleSync}
              disabled={!activeAccount || isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Sincronização automática</Label>
              <p className="text-sm text-muted-foreground">
                Sincronizar posts e comentários a cada 15 minutos
              </p>
            </div>
            <Switch defaultChecked disabled={!activeAccount} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure quando você deseja receber notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Novos comentários</Label>
              <p className="text-sm text-muted-foreground">
                Notificar quando receber um novo comentário
              </p>
            </div>
            <Switch defaultChecked disabled={!activeAccount} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Novas mensagens</Label>
              <p className="text-sm text-muted-foreground">
                Notificar quando receber uma nova DM
              </p>
            </div>
            <Switch defaultChecked disabled={!activeAccount} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstagramSettings;
