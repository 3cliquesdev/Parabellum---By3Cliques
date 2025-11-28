import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, AlertTriangle, DollarSign, Trophy } from "lucide-react";
import { useCustomerContext } from "@/hooks/useCustomerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SuccessVisionCardProps {
  contactId: string;
}

export default function SuccessVisionCard({ contactId }: SuccessVisionCardProps) {
  const { data: context, isLoading } = useCustomerContext(contactId);

  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Se não tem deal ganho com informações de handoff, não mostrar
  const deal = context?.deal;
  if (!deal || (!deal.expected_revenue && !deal.success_criteria && !deal.pain_points)) {
    return null;
  }

  // Determinar cor da borda baseado no risco de churn
  const riskColor = deal?.churn_risk === "high" 
    ? "border-red-500/50 bg-red-500/5" 
    : deal?.churn_risk === "medium"
    ? "border-yellow-500/30 bg-yellow-500/5"
    : "border-primary/30 bg-primary/5";

  // Badge de risco
  const riskBadge = deal?.churn_risk && (
    <Badge 
      variant={deal.churn_risk === "high" ? "destructive" : "secondary"}
      className={cn(
        deal.churn_risk === "medium" && "bg-yellow-500/20 text-yellow-700 border-yellow-500/30"
      )}
    >
      {deal.churn_risk === "high" && "⚠️ Risco Alto"}
      {deal.churn_risk === "medium" && "⚡ Risco Médio"}
      {deal.churn_risk === "low" && "✅ Risco Baixo"}
    </Badge>
  );

  return (
    <Card className={cn("border-2 bg-gradient-to-br to-transparent", riskColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Dossiê de Sucesso</CardTitle>
          {riskBadge}
          <Badge variant="secondary" className="ml-auto text-xs">
            Handoff do Vendedor
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meta de Faturamento */}
        {deal.expected_revenue && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <DollarSign className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">
                Meta do Cliente
              </p>
              <p className="text-lg font-bold text-green-600">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(deal.expected_revenue))}/mês
              </p>
            </div>
          </div>
        )}

        {/* Critério de Sucesso */}
        {deal.success_criteria && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Target className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">
                Definição de Sucesso
              </p>
              <p className="text-sm text-foreground mt-1">
                {deal.success_criteria}
              </p>
            </div>
          </div>
        )}

        {/* Dores Principais */}
        {deal.pain_points && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">
                Principais Dores
              </p>
              <p className="text-sm text-foreground mt-1">
                {deal.pain_points}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
