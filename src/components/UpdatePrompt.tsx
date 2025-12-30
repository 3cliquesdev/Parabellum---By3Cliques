import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export const UpdatePrompt = () => {
  const { needRefresh, update, dismiss } = useServiceWorkerUpdate();

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-primary text-primary-foreground p-3 flex items-center justify-center gap-4 shadow-lg"
        >
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Nova versão disponível!</span>
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={update}
            className="h-7 px-3 text-xs"
          >
            Atualizar Agora
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={dismiss}
            className="h-7 w-7 hover:bg-primary-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
