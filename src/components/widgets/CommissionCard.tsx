import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingDown, AlertCircle } from "lucide-react";

interface CommissionCardProps {
  currentValue: number;
  targetValue: number;
  commissionRate: number; // Percentage (e.g., 5.00 = 5%)
}

export function CommissionCard({ currentValue, targetValue, commissionRate }: CommissionCardProps) {
  const potentialCommission = (targetValue * commissionRate) / 100;
  const earnedCommission = (currentValue * commissionRate) / 100;
  const lostCommission = potentialCommission - earnedCommission;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (commissionRate === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Calculadora de Comissão
          </CardTitle>
          <CardDescription>
            Nenhuma comissão configurada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Configure a taxa de comissão nas configurações da meta
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-green-600" />
            Comissão Estimada
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {commissionRate.toFixed(1)}%
          </Badge>
        </div>
        <CardDescription>
          Motivação financeira para bater a meta
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Earned Commission */}
        <div className="text-center py-4 mb-4 border-b">
          <p className="text-sm text-muted-foreground mb-2">Comissão Conquistada</p>
          <p className="text-4xl font-bold text-green-600">
            {formatCurrency(earnedCommission)}
          </p>
        </div>

        {/* Potential Commission */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Potencial Total</p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(potentialCommission)}
            </p>
          </div>
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="h-3 w-3 text-destructive" />
              <p className="text-xs text-muted-foreground">Não Ganho</p>
            </div>
            <p className="text-lg font-bold text-destructive">
              {formatCurrency(lostCommission)}
            </p>
          </div>
        </div>

        {/* Motivation Message */}
        {lostCommission > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-500 mb-1">
              💰 Você está deixando de ganhar
            </p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-500">
              {formatCurrency(lostCommission)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Feche mais {formatCurrency(targetValue - currentValue)} em vendas para conquistar esta comissão!
            </p>
          </div>
        )}

        {/* Success Message */}
        {currentValue >= targetValue && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm font-semibold text-green-600 mb-1">
              🎉 Parabéns! Meta atingida!
            </p>
            <p className="text-xs text-muted-foreground">
              Você garantiu {formatCurrency(potentialCommission)} em comissões este mês!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}