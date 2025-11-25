import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCommissionTracker } from "@/hooks/useCommissionTracker";
import { DollarSign, TrendingUp, Target, Loader2, Trophy } from "lucide-react";

export default function CommissionTrackerWidget() {
  const { data: commission, isLoading } = useCommissionTracker();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Meu Bônus deste Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </CardContent>
      </Card>
    );
  }

  if (!commission) {
    return null;
  }

  const isMeta100 = commission.percentual_atingido >= 100;

  return (
    <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Meu Bônus deste Mês
          </div>
          {isMeta100 && (
            <Badge className="bg-green-500 text-white animate-pulse">
              <Trophy className="h-3 w-3 mr-1" />
              Meta Batida!
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comissão Estimada */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Comissão Estimada</p>
          <p className="text-4xl font-bold text-green-500">
            R$ {commission.comissao_estimada.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Meta: R$ {commission.meta_renovacao.toLocaleString("pt-BR")}</span>
            </div>
            <span className="font-semibold">{commission.percentual_atingido}%</span>
          </div>
          
          <Progress 
            value={Math.min(commission.percentual_atingido, 100)} 
            className="h-3"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Renovado: R$ {commission.renovado.toLocaleString("pt-BR")}</span>
            {!isMeta100 && (
              <span>Faltam: R$ {commission.falta_para_meta.toLocaleString("pt-BR")}</span>
            )}
          </div>
        </div>

        {/* Breakdown de Clientes */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Renovados</p>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-lg font-semibold">{commission.clientes_renovados}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-yellow-500" />
              <span className="text-lg font-semibold">{commission.clientes_pendentes}</span>
            </div>
          </div>
        </div>

        {/* Motivação */}
        {!isMeta100 && commission.falta_para_meta > 0 && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-center text-muted-foreground">
              Renove mais <span className="font-semibold text-green-500">R$ {commission.falta_para_meta.toLocaleString("pt-BR")}</span> para bater a meta e aumentar seu bônus! 🚀
            </p>
          </div>
        )}

        {isMeta100 && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-center font-semibold text-green-500">
              Parabéns! Você bateu a meta do mês! 🎉
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
