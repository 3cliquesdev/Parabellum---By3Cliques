import { useWhatsAppInstanceRealtime } from '@/hooks/useWhatsAppInstanceRealtime';

/**
 * Componente invisível que monitora desconexões de WhatsApp em tempo real
 * e exibe toasts quando instâncias desconectam/reconectam.
 * 
 * Deve ser montado uma vez no layout principal (App.tsx ou similar).
 */
export function WhatsAppDisconnectMonitor() {
  // Ativar subscription global de WhatsApp
  useWhatsAppInstanceRealtime();
  
  // Componente não renderiza nada visualmente
  return null;
}
