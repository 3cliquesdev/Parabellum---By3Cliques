import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, X, Tag, Trash2 } from "lucide-react";
import { BulkPlaybookDialog } from "./BulkPlaybookDialog";
import { motion, AnimatePresence } from "framer-motion";

interface ContactsBulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function ContactsBulkActions({
  selectedIds,
  onClearSelection,
}: ContactsBulkActionsProps) {
  const [showPlaybookDialog, setShowPlaybookDialog] = useState(false);

  if (selectedIds.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedIds.length} cliente{selectedIds.length > 1 ? "s" : ""} selecionado{selectedIds.length > 1 ? "s" : ""}
            </span>
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setShowPlaybookDialog(true)}
                className="gap-1"
              >
                <Play className="h-4 w-4" />
                Iniciar Playbook
              </Button>
            </div>
            
            <div className="h-6 w-px bg-border" />
            
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      <BulkPlaybookDialog
        open={showPlaybookDialog}
        onOpenChange={setShowPlaybookDialog}
        selectedContactIds={selectedIds}
        onSuccess={onClearSelection}
      />
    </>
  );
}
