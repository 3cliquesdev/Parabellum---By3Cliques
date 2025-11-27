import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle, AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: any;
}

export function QRCodeModal({ open, onOpenChange, instance }: QRCodeModalProps) {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(instance?.qr_code_base64);
  const [status, setStatus] = useState<string>(instance?.status || 'disconnected');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Sempre sincroniza estado local com a instância mais recente
  useEffect(() => {
    if (!instance) return;
    setQrCode(instance.qr_code_base64 ?? null);
    setStatus(instance.status ?? 'disconnected');
  }, [instance]);

  // Auto-refresh QR Code a cada 15 segundos enquanto status for qr_pending
  useEffect(() => {
    if (!instance?.id || !open || status !== 'qr_pending') return;

    const interval = setInterval(() => {
      console.log('[QRCodeModal] Auto-refreshing QR code...');
      handleRefreshQR();
    }, 15000); // 15 segundos

    return () => clearInterval(interval);
  }, [instance?.id, open, status]);

  // Realtime subscription para status da instância
  useEffect(() => {
    if (!instance?.id || !open) return;

    const channel = supabase
      .channel(`whatsapp-instance-${instance.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_instances',
          filter: `id=eq.${instance.id}`,
        },
        (payload) => {
          console.log('[QRCodeModal] Instance updated:', payload.new);
          setStatus(payload.new.status);
          setQrCode(payload.new.qr_code_base64);
          
          // Feedback automático quando conectar
          if (payload.new.status === 'connected' && status !== 'connected') {
            toast({
              title: "✅ WhatsApp Conectado!",
              description: `Número: ${payload.new.phone_number || 'Carregando...'}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instance?.id, open, status, toast]);

  const handleRefreshQR = async () => {
    setIsRefreshing(true);
    try {
      // Buscar QR Code atualizado do banco
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('qr_code_base64, status')
        .eq('id', instance.id)
        .single();

      if (error) throw error;
      
      setQrCode(data.qr_code_base64);
      setStatus(data.status);
    } catch (error) {
      console.error('[QRCodeModal] Error refreshing QR:', error);
      toast({
        title: "Erro ao atualizar QR Code",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetInstance = async () => {
    if (!confirm('⚠️ Resetar instância?\n\nIsso vai limpar a sessão atual e gerar um novo QR Code.')) {
      return;
    }

    setIsResetting(true);
    try {
      // Chamar Edge Function para resetar (delete + create)
      const { error } = await supabase.functions.invoke('connect-whatsapp-instance', {
        body: { instance_id: instance.id }
      });

      if (error) throw error;

      toast({
        title: "🔄 Instância Resetada",
        description: "Um novo QR Code foi gerado. Escaneie novamente.",
      });
    } catch (error) {
      console.error('[QRCodeModal] Error resetting instance:', error);
      toast({
        title: "Erro ao resetar instância",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'qr_pending':
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Aguardando Conexão
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive">
            Desconectado
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Conectar WhatsApp</span>
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Debug Info - URL da API */}
          <div className="bg-muted/50 p-3 rounded-md space-y-1">
            <p className="text-xs text-muted-foreground">
              🔧 Debug: Conectando em
            </p>
            <code className="text-xs font-mono text-foreground break-all">
              {instance.api_url}
            </code>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
              ⚠️ Certifique-se de que esta URL é acessível publicamente (HTTPS)
            </p>
          </div>

          {status === 'connected' ? (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                WhatsApp Conectado!
              </p>
              <p className="text-sm text-muted-foreground">
                Número: {instance.phone_number || 'Carregando...'}
              </p>
            </div>
          ) : qrCode ? (
            <div className="space-y-4">
              {/* QR Code Display */}
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
              
              {/* Instructions */}
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Escaneie o QR Code com seu WhatsApp
                </p>
                <p className="text-xs text-muted-foreground">
                  1. Abra o WhatsApp no seu celular<br />
                  2. Toque em Mais opções {'>'} Aparelhos conectados<br />
                  3. Toque em Conectar um aparelho<br />
                  4. Aponte o celular para esta tela
                </p>
              </div>

              {/* Auto-refresh indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Atualizando automaticamente a cada 15s...</span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={handleRefreshQR}
                  disabled={isRefreshing}
                  variant="outline"
                  className="w-full"
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Gerar Novo Código
                </Button>

                <Button
                  onClick={handleResetInstance}
                  disabled={isResetting}
                  variant="destructive"
                  className="w-full"
                >
                  {isResetting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Resetar Instância (Limpar Sessão)
                </Button>
              </div>

              {/* Troubleshooting Tips */}
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-md space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300">
                      QR Code não funciona?
                    </p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                      <li>Verifique quantos aparelhos estão conectados (máx: 4)</li>
                      <li>Remova dispositivos antigos/não usados</li>
                      <li>Aguarde 1-2 minutos antes de tentar novamente</li>
                      <li>Use "Resetar Instância" se o problema persistir</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Gerando QR Code...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
