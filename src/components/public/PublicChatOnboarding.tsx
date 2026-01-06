import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bell, Download, Smartphone, MessageSquare } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useNotificationSound } from '@/hooks/useNotificationSound';

interface PublicChatOnboardingProps {
  messagesSent: number;
  messagesReceived: number;
}

export function PublicChatOnboarding({ messagesSent, messagesReceived }: PublicChatOnboardingProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { canInstall, install, isInstalled } = usePWAInstall();
  const { requestPermission, isSupported } = useNotificationSound();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (isSupported && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [isSupported]);

  useEffect(() => {
    // Show onboarding after first message sent AND first response received
    const hasShown = localStorage.getItem('public_chat_onboarding_shown');
    const shouldShow = messagesSent >= 1 && messagesReceived >= 1 && !hasShown;

    if (shouldShow) {
      const timer = setTimeout(() => {
        // Only show if there's something to offer
        const hasNotificationOption = isSupported && notificationPermission !== 'granted';
        const hasPWAOption = canInstall && !isInstalled;
        
        if (hasNotificationOption || hasPWAOption) {
          setShowOnboarding(true);
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [messagesSent, messagesReceived, canInstall, isInstalled, isSupported, notificationPermission]);

  const handleEnableNotifications = async () => {
    await requestPermission();
    setNotificationPermission(Notification.permission);
  };

  const handleInstallPWA = async () => {
    await install();
  };

  const handleDismiss = () => {
    localStorage.setItem('public_chat_onboarding_shown', 'true');
    setShowOnboarding(false);
  };

  const handleComplete = () => {
    localStorage.setItem('public_chat_onboarding_shown', 'true');
    setShowOnboarding(false);
  };

  const showNotificationButton = isSupported && notificationPermission !== 'granted';
  const showPWAButton = canInstall && !isInstalled;

  if (!showOnboarding) return null;

  return (
    <Sheet open={showOnboarding} onOpenChange={setShowOnboarding}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <SheetTitle className="text-xl">Fique por dentro!</SheetTitle>
          <p className="text-muted-foreground text-sm">
            Não perca nenhuma resposta do nosso time
          </p>
        </SheetHeader>

        <div className="space-y-3 py-4">
          {showNotificationButton && (
            <button
              onClick={handleEnableNotifications}
              className="w-full flex items-center gap-3 p-4 bg-muted hover:bg-muted/80 rounded-lg transition-colors text-left"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Ativar notificações</p>
                <p className="text-xs text-muted-foreground">
                  Receba alertas quando respondermos
                </p>
              </div>
            </button>
          )}

          {showPWAButton && (
            <button
              onClick={handleInstallPWA}
              className="w-full flex items-center gap-3 p-4 bg-muted hover:bg-muted/80 rounded-lg transition-colors text-left"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Instalar app</p>
                <p className="text-xs text-muted-foreground">
                  Acesse rápido pela tela inicial
                </p>
              </div>
            </button>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={handleDismiss} className="flex-1">
            Agora não
          </Button>
          <Button onClick={handleComplete} className="flex-1">
            Continuar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
