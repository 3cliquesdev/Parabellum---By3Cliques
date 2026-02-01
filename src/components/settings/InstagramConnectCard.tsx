import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Instagram, Loader2, CheckCircle2, XCircle, Link2, Unlink } from "lucide-react";
import { useConnectInstagram, useInstagramAccounts, useDisconnectInstagram } from "@/hooks/instagram/useInstagramAccounts";
import { useUserRole } from "@/hooks/useUserRole";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function InstagramConnectCard() {
  const { isAdmin, isManager } = useUserRole();
  const { startOAuth, isLoading: isConnecting } = useConnectInstagram();
  const { data: accounts, isLoading: isLoadingAccounts } = useInstagramAccounts();
  const disconnectMutation = useDisconnectInstagram();

  // Only managers and admins can see this card
  const canAccess = isAdmin || isManager;
  
  if (!canAccess) {
    return null;
  }

  const activeAccounts = accounts?.filter(a => a.is_active) || [];
  const hasActiveAccount = activeAccounts.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram className="h-5 w-5" />
          Conectar Conta Instagram
          {hasActiveAccount ? (
            <Badge variant="default" className="ml-2">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-2">
              <XCircle className="h-3 w-3 mr-1" />
              Não Conectado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Vincule uma conta Instagram Business para receber e responder mensagens e comentários
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingAccounts ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : hasActiveAccount ? (
          <div className="space-y-4">
            {activeAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={account.profile_picture_url || undefined} />
                    <AvatarFallback>
                      <Instagram className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">@{account.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.followers_count?.toLocaleString()} seguidores
                      {account.last_sync_at && (
                        <> • Sincronizado {formatDistanceToNow(new Date(account.last_sync_at), { addSuffix: true, locale: ptBR })}</>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate(account.id)}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="h-4 w-4 mr-2" />
                      Desconectar
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Instagram className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              Nenhuma conta Instagram conectada
            </p>
            <Button onClick={startOAuth} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Conectar Instagram
            </Button>
          </div>
        )}

        {hasActiveAccount && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={startOAuth} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Adicionar Outra Conta
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
