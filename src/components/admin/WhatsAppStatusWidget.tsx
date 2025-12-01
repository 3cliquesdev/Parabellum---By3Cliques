import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { Loader2, MessageCircle, RefreshCw, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function WhatsAppStatusWidget() {
  const { data: instances, isLoading, refetch } = useWhatsAppInstances();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            WhatsApp Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const connectedCount = instances?.filter(i => i.status === 'open').length || 0;
  const disconnectedCount = instances?.filter(i => i.status === 'disconnected' || i.status === 'close').length || 0;
  const totalCount = instances?.length || 0;

  const getStatusVariant = (status: string) => {
    if (status === 'open') return 'default';
    return 'destructive';
  };

  const getStatusText = (status: string) => {
    if (status === 'open') return 'Conectado';
    return 'Desconectado';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              WhatsApp Status
            </CardTitle>
            <CardDescription>
              {connectedCount} de {totalCount} instância(s) conectada(s)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/whatsapp')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {disconnectedCount > 0 && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium">
              🚨 {disconnectedCount} instância(s) desconectada(s)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Configurações" para reconectar
            </p>
          </div>
        )}

        <div className="space-y-3">
          {instances?.map((instance) => (
            <div
              key={instance.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${
                  instance.status === 'open' ? 'bg-green-600' : 'bg-red-600'
                } animate-pulse`} />
                <div>
                  <p className="text-sm font-medium">{instance.name}</p>
                  {instance.phone_number && (
                    <p className="text-xs text-muted-foreground">{instance.phone_number}</p>
                  )}
                </div>
              </div>
              <Badge variant={getStatusVariant(instance.status)}>
                {getStatusText(instance.status)}
              </Badge>
            </div>
          ))}

          {totalCount === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma instância configurada</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate('/settings/whatsapp')}
              >
                Adicionar Instância
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
