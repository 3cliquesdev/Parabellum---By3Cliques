import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import KanbanCard from "./KanbanCard";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string } | null;
  organizations: { name: string } | null;
};

interface KanbanColumnProps {
  stage: Tables<"stages">;
  deals: Deal[];
}

export default function KanbanColumn({ stage, deals }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      stage,
    },
  });

  return (
    <div className="flex-shrink-0 w-80">
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">{stage.name}</h3>
          <span className="text-sm text-[#999999] bg-[#0d0d0d] rounded-full px-2 py-1">
            {deals.length}
          </span>
        </div>

        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[500px] transition-colors rounded-lg",
            isOver && "bg-primary/5 ring-2 ring-primary"
          )}
        >
          {deals.map((deal) => (
            <KanbanCard key={deal.id} deal={deal} />
          ))}
          {deals.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Nenhum negócio
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
