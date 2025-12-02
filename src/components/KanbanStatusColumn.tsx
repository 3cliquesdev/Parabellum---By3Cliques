import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import KanbanCard from "./KanbanCard";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string } | null;
  organizations: { name: string } | null;
  assigned_user: { id: string; full_name: string; avatar_url: string | null } | null;
};

interface KanbanStatusColumnProps {
  status: "won" | "lost";
  title: string;
  deals: Deal[];
}

export default function KanbanStatusColumn({ status, title, deals }: KanbanStatusColumnProps) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 10;
  
  const visibleDeals = showAll ? deals : deals.slice(0, LIMIT);
  const hasMore = deals.length > LIMIT;
  const remaining = deals.length - LIMIT;

  // Calculate total value
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-shrink-0 w-64">
      <div className={cn(
        "rounded-xl p-3 border",
        status === "won" && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50",
        status === "lost" && "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span 
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                status === "won" && "bg-green-500",
                status === "lost" && "bg-red-500"
              )}
            />
            <h3 className={cn(
              "text-sm font-semibold",
              status === "won" && "text-green-700 dark:text-green-400",
              status === "lost" && "text-red-700 dark:text-red-400"
            )}>
              {title}
            </h3>
          </div>
          <span className={cn(
            "text-sm rounded-full px-2 py-1",
            status === "won" && "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400",
            status === "lost" && "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
          )}>
            {deals.length}
          </span>
        </div>

        {/* Financial Summary */}
        {totalValue > 0 && (
          <div className={cn(
            "mb-2 p-2 rounded-lg border",
            status === "won" && "bg-green-100/50 dark:bg-green-900/30 border-green-200 dark:border-green-800/50",
            status === "lost" && "bg-red-100/50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50"
          )}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Total:</span>
              <span className={cn(
                "text-sm font-bold",
                status === "won" && "text-green-700 dark:text-green-400",
                status === "lost" && "text-red-700 dark:text-red-400"
              )}>
                {formatCurrency(totalValue)}
              </span>
            </div>
          </div>
        )}

        <div className="min-h-[100px] space-y-2">
          {visibleDeals.map((deal) => (
            <KanbanCard key={deal.id} deal={deal} />
          ))}
          
          {deals.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Nenhum negócio
            </div>
          )}

          {/* Ver Mais / Ver Menos Button */}
          {hasMore && (
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "w-full mt-2",
                status === "won" && "hover:bg-green-100 dark:hover:bg-green-900/30",
                status === "lost" && "hover:bg-red-100 dark:hover:bg-red-900/30"
              )}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Ver mais ({remaining})
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
