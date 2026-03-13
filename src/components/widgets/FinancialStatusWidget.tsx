import { Card } from "@/components/ui/card";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface FinancialStatusWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function FinancialStatusWidget({ startDate, endDate }: FinancialStatusWidgetProps) {
  const { data, isLoading } = useKiwifyFinancials(startDate, endDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border rounded-3xl p-8 animate-pulse">
        <div className="h-24 bg-muted rounded-2xl" />
      </Card>
    );
  }

  const collected = data?.totalGrossRevenue || 0;
  const spent = (data?.totalKiwifyFees || 0) + (data?.totalAffiliateCommissions || 0);
  const balance = data?.totalNetRevenue || 0;

  return (
    <Card className="bg-card border-border rounded-3xl p-8 animate-fade-in">
      <div className="grid grid-cols-3 gap-8">
        {/* Arrecadado */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Arrecadado</span>
          </div>
          <p className="text-5xl font-bold text-success">
            {formatCurrency(collected)}
          </p>
          <p className="text-xs text-muted-foreground">Receita bruta Kiwify</p>
        </div>

        {/* Gasto */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDown className="h-4 w-4" />
            <span>Custos</span>
          </div>
          <p className="text-5xl font-bold text-destructive">
            {formatCurrency(spent)}
          </p>
          <p className="text-xs text-muted-foreground">Taxas + comissões</p>
        </div>

        {/* Saldo */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Saldo</span>
          </div>
          <p className="text-5xl font-bold text-foreground">
            {formatCurrency(balance)}
          </p>
          <p className="text-xs text-muted-foreground">Receita líquida</p>
        </div>
      </div>
    </Card>
  );
}
