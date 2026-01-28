import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Bot, X, CheckSquare, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InboxBulkDistributeBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDistribute: () => void;
  onReactivateAI: () => void;
  onCloseConversations?: () => void;
  isDistributing?: boolean;
  isReactivating?: boolean;
  isClosing?: boolean;
}

export function InboxBulkDistributeBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDistribute,
  onReactivateAI,
  onCloseConversations,
  isDistributing,
  isReactivating,
  isClosing,
}: InboxBulkDistributeBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl shadow-lg">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} conversa{selectedCount > 1 ? "s" : ""} selecionada{selectedCount > 1 ? "s" : ""}
          </span>

          <div className="h-6 border-l border-border" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            className="gap-1 text-xs"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {selectedCount === totalCount ? "Desmarcar" : "Todas"}
          </Button>

          <div className="h-6 border-l border-border" />

          <Button
            variant="default"
            size="sm"
            onClick={onDistribute}
            disabled={isDistributing}
            className="gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Distribuir
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onReactivateAI}
            disabled={isReactivating}
            className="gap-2"
          >
            <Bot className="h-4 w-4" />
            Reativar IA
          </Button>

          {onCloseConversations && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onCloseConversations}
              disabled={isClosing}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Encerrar
            </Button>
          )}

          <div className="h-6 border-l border-border" />

          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground hover:text-foreground"
            onClick={onClearSelection}
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
