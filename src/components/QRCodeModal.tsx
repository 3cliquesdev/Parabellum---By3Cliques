import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: any;
}

export function QRCodeModal({ open, onOpenChange, instance }: QRCodeModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(instance?.qr_code_base64);
  const [status, setStatus] = useState<string>(instance?.status || 'disconnected');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sempre sincroniza estado local com a instância mais recente
  useEffect(() => {
    if (!instance) return;
    setQrCode(instance.qr_code_base64 ?? null);
    setStatus(instance.status ?? 'disconnected');
  }, [instance]);

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instance?.id, open]);

  const handleRefreshQR = async () => {
    setIsRefreshing(true);
    try {
      // Buscar QR Code atualizado
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
    } finally {
      setIsRefreshing(false);
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
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
              
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
                Atualizar QR Code
              </Button>
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
