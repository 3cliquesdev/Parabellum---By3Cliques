import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function BackfillHistoricalDeals() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    updated_count: number;
    total_deals_without_product: number;
  } | null>(null);

  const handleBackfill = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('backfill-deal-products', {
        body: {},
      });

      if (error) throw error;

      setResult(data);
      
      toast({
        title: "✅ Backfill concluído",
        description: `${data.updated_count} de ${data.total_deals_without_product} deals foram vinculados a produtos`,
      });
    } catch (error) {
      console.error('Erro no backfill:', error);
      toast({
        title: "❌ Erro no backfill",
        description: "Não foi possível processar os dados históricos",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🔄 Backfill de Dados Históricos</CardTitle>
        <CardDescription>
          Vincular deals antigos sem product_id aos produtos corretos usando histórico de interações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-sm">
            Esta função busca todos os deals sem <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">product_id</code> e tenta vinculá-los 
            aos produtos corretos analisando o histórico de interações com Kiwify. 
            Isso resolve o problema de "Produto não identificado" retroativamente.
          </AlertDescription>
        </Alert>

        {result && (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              ✅ Processamento concluído
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {result.updated_count} de {result.total_deals_without_product} deals foram atualizados
            </p>
          </div>
        )}

        <Button 
          onClick={handleBackfill} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando dados históricos...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Executar Backfill
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
