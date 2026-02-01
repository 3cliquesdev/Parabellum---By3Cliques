import { useState } from "react";
import { useInstagramAccounts, useConnectInstagram, useDisconnectInstagram, useSyncInstagram } from "@/hooks/instagram";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Instagram, 
  Link2, 
  Unlink, 
  RefreshCw, 
  Bell,
  Check,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import InstagramCredentialsCard from "@/components/settings/InstagramCredentialsCard";

const InstagramSettings = () => {
  const { data: accounts, isLoading } = useInstagramAccounts();
  const { startOAuth, isLoading: isConnecting } = useConnectInstagram();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectInstagram();
  const { mutate: syncNow, isPending: isSyncing } = useSyncInstagram();

  const activeAccount = accounts?.find((a) => a.is_active);

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
      {/* Credentials Configuration */}
      <InstagramCredentialsCard />

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
              <h3 className="font-medium mb-2">Conecte sua conta Instagram Business</h3>
              <p className="text-muted-foreground mb-4 text-sm max-w-md mx-auto">
                Clique no botão abaixo e faça login com sua conta do Facebook que está vinculada ao seu Instagram Business
              </p>
              <Button onClick={startOAuth} disabled={isConnecting}>
                <Link2 className="h-4 w-4 mr-2" />
                {isConnecting ? "Conectando..." : "Conectar Instagram Business"}
              </Button>
            </div>
          )}
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
