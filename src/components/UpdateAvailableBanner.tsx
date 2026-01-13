import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkForUpdate, forceUpdate } from "@/lib/build/ensureLatestBuild";

// Intervalo de verificação: 60 segundos
const CHECK_INTERVAL_MS = 60 * 1000;

// Tempo para reaparecer após "Depois": 5 minutos
const DISMISS_DURATION_MS = 5 * 60 * 1000;

export function UpdateAvailableBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const performCheck = useCallback(async () => {
    try {
      const hasUpdate = await checkForUpdate();
      if (hasUpdate) {
        setUpdateAvailable(true);
      }
    } catch (e) {
      console.warn('[UpdateBanner] Erro ao verificar:', e);
    }
  }, []);

  useEffect(() => {
    // Check inicial após 5 segundos (dar tempo para o app carregar)
    const initialTimeout = setTimeout(performCheck, 5000);
    
    // Checks periódicos
    const interval = setInterval(performCheck, CHECK_INTERVAL_MS);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [performCheck]);

  // Lógica para reaparecer após dismiss
  useEffect(() => {
    if (dismissed && updateAvailable) {
      const timeout = setTimeout(() => {
        setDismissed(false);
      }, DISMISS_DURATION_MS);
      
      return () => clearTimeout(timeout);
    }
  }, [dismissed, updateAvailable]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    await forceUpdate();
    // Nota: forceUpdate faz reload, então o estado não importa após isso
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Não mostrar se não há update ou foi dispensado
  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-primary via-primary/90 to-primary-hover text-primary-foreground shadow-lg"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Mensagem */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-semibold">Nova versão disponível!</span>
                <span className="text-sm opacity-90 hidden sm:inline">
                  Atualize para ter acesso às últimas melhorias.
                </span>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUpdate}
                disabled={isUpdating}
                className="bg-white/20 hover:bg-white/30 text-white border-none"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline ml-1">Atualizando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Atualizar agora</span>
                  </>
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                title="Lembrar depois"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
