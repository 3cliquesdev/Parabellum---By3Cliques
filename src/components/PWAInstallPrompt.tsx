import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Zap, Wifi } from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Mostrar após 5 segundos de uso ou 2a visita
      const visits = parseInt(localStorage.getItem('pwa_visits') || '0') + 1;
      localStorage.setItem('pwa_visits', visits.toString());
      
      if (visits >= 2 && !localStorage.getItem('pwa_dismissed') && !localStorage.getItem('pwa_installed')) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem('pwa_installed', 'true');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <Sheet open={showPrompt} onOpenChange={setShowPrompt}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <SheetTitle className="text-xl">Instale nosso App</SheetTitle>
          <p className="text-muted-foreground text-sm">
            Tenha acesso rápido ao suporte direto do seu celular
          </p>
        </SheetHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="text-sm">Abertura instantânea</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Wifi className="w-5 h-5 text-green-500" />
            <span className="text-sm">Funciona offline</span>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={handleDismiss} className="flex-1">
            Agora não
          </Button>
          <Button onClick={handleInstall} className="flex-1 gap-2">
            <Download className="w-4 h-4" />
            Instalar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
