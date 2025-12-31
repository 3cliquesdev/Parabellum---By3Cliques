import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTopPerformers } from "@/hooks/useTopPerformers";
import { DateRange } from "react-day-picker";
import { Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopPerformersWidgetProps {
  dateRange: DateRange | undefined;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const getMedalColor = (position: number) => {
  switch (position) {
    case 0: return "text-amber-500"; // Gold
    case 1: return "text-slate-400"; // Silver
    case 2: return "text-amber-700"; // Bronze
    default: return "text-muted-foreground";
  }
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function TopPerformersWidget({ dateRange }: TopPerformersWidgetProps) {
  const { data: performers, isLoading } = useTopPerformers(dateRange, 5);

  const maxRevenue = performers?.[0]?.revenueWon || 1;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-medium">Top Vendedores</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : !performers || performers.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado disponível para o período
          </div>
        ) : (
          <div className="space-y-3">
            {performers.map((performer, index) => {
              const progressWidth = (performer.revenueWon / maxRevenue) * 100;
              
              return (
                <div key={performer.id} className="group">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={performer.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(performer.name)}
                        </AvatarFallback>
                      </Avatar>
                      {index < 3 && (
                        <Medal className={cn(
                          "absolute -top-1 -right-1 h-3.5 w-3.5",
                          getMedalColor(index)
                        )} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {performer.name}
                        </p>
                        <span className="text-sm font-semibold text-foreground shrink-0">
                          {formatCurrency(performer.revenueWon)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {performer.dealsWon} {performer.dealsWon === 1 ? "deal" : "deals"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
