import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useContactEfficiency } from "@/hooks/useContactEfficiency";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone } from "lucide-react";

export function ContactEfficiencyWidget() {
  const { data: efficiency, isLoading } = useContactEfficiency();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📞 Eficiência de Contato</CardTitle>
          <CardDescription>Média de toques para conversão</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!efficiency || efficiency.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Eficiência de Contato
          </CardTitle>
          <CardDescription>Média de toques para conversão</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Sem dados de conversão disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  const globalAvgTouches = efficiency.reduce((sum, rep) => sum + rep.avgTouchesToConversion, 0) / efficiency.length;
  const mostEfficient = efficiency[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Eficiência de Contato
        </CardTitle>
        <CardDescription>Média de toques para conversão</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Métrica Global */}
          <div className="text-center p-4 bg-primary/10 rounded-lg">
            <div className="text-4xl font-bold text-primary">
              {globalAvgTouches.toFixed(1)} toques
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Para fechar 1 venda (média da empresa)
            </p>
          </div>
          
          {/* Por vendedor */}
          <div className="space-y-2">
            {efficiency.slice(0, 3).map((rep) => (
              <div key={rep.repId} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{rep.repName}</p>
                  <p className="text-xs text-muted-foreground">
                    {rep.emailsSent} emails • {rep.callsMade} ligações • {rep.whatsappSent} msgs
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {rep.avgTouchesToConversion.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground">toques/venda</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Insight */}
          {mostEfficient && (
            <div className="p-3 bg-green-500/10 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400">
                💡 <strong>{mostEfficient.repName}</strong> é o mais eficiente: fecha vendas com apenas{" "}
                <strong>{mostEfficient.avgTouchesToConversion.toFixed(1)}</strong> toques em média
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
