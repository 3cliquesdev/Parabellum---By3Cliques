import { useDroppable } from "@dnd-kit/core";
import { Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragDropActionBarProps {
  isVisible: boolean;
}

export default function DragDropActionBar({ isVisible }: DragDropActionBarProps) {
  const { setNodeRef: setWonRef, isOver: isOverWon } = useDroppable({
    id: "won-zone",
    data: { action: "won" },
  });

  const { setNodeRef: setLostRef, isOver: isOverLost } = useDroppable({
    id: "lost-zone",
    data: { action: "lost" },
  });

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t-2 border-border shadow-2xl">
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Won Zone */}
          <div
            ref={setWonRef}
            className={cn(
              "relative h-32 rounded-xl border-4 border-dashed transition-all duration-200",
              "flex items-center justify-center gap-3",
              "bg-green-500/10 border-green-500/30 dark:bg-green-500/5 dark:border-green-500/20",
              isOverWon && "bg-green-500/20 dark:bg-green-500/10 border-green-600 scale-105 shadow-xl"
            )}
          >
            <Trophy className={cn(
              "h-10 w-10 text-green-600 transition-transform",
              isOverWon && "scale-125"
            )} />
            <div className="text-center">
              <p className="text-xl font-bold text-green-700">🟢 Ganho</p>
              <p className="text-sm text-green-600">Solte aqui para marcar como GANHO</p>
            </div>
          </div>

          {/* Lost Zone */}
          <div
            ref={setLostRef}
            className={cn(
              "relative h-32 rounded-xl border-4 border-dashed transition-all duration-200",
              "flex items-center justify-center gap-3",
              "bg-rose-500/10 border-rose-500/30 dark:bg-rose-500/5 dark:border-rose-500/20",
              isOverLost && "bg-rose-500/20 dark:bg-rose-500/10 border-rose-600 scale-105 shadow-xl"
            )}
          >
            <X className={cn(
              "h-10 w-10 text-red-600 transition-transform",
              isOverLost && "scale-125"
            )} />
            <div className="text-center">
              <p className="text-xl font-bold text-red-700">🔴 Perdido</p>
              <p className="text-sm text-red-600">Solte aqui para marcar como PERDIDO</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
