import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, AlertTriangle, DollarSign, Trophy } from "lucide-react";
import { useCustomerContext } from "@/hooks/useCustomerContext";
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Visão de Sucesso</CardTitle>
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
