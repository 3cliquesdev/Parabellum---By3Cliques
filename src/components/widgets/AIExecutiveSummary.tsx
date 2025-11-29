import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";

interface AIExecutiveSummaryProps {
  data: Record<string, any>;
  context: string; // 'support' | 'sales' | 'ai' | 'onboarding' | 'whatsapp'
  startDate: Date;
  endDate: Date;
}

export function AIExecutiveSummary({ data, context, startDate, endDate }: AIExecutiveSummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateAnalysis = async () => {
    setIsGenerating(true);
    setAnalysis(null);

    try {
      const { data: result, error } = await supabase.functions.invoke('analyze-dashboard', {
        body: {
          metricsData: data,
          context,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }
      });

      if (error) {
        throw error;
      }

      if (result?.analysis) {
        setAnalysis(result.analysis);
        toast({
          title: "✅ Análise Gerada",
          description: "A IA analisou os dados do período selecionado.",
        });
      } else {
        throw new Error("Resposta inválida da IA");
      }
    } catch (error) {
      console.error('[AIExecutiveSummary] Error:', error);
      toast({
        title: "❌ Erro ao Gerar Análise",
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-violet-900 dark:text-violet-100">
          <Brain className="h-5 w-5" />
          Análise da IA 🤖
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </CardTitle>
        <CardDescription className="text-violet-700 dark:text-violet-300">
          Insights inteligentes sobre o desempenho no período selecionado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis && !isGenerating && (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                <Brain className="h-8 w-8 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-sm text-violet-600 dark:text-violet-400 max-w-md">
                A IA pode analisar os dados da tela e identificar tendências, gargalos e oportunidades de melhoria.
              </p>
              <Button 
                onClick={handleGenerateAnalysis}
                className="bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Análise do Período
              </Button>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <Brain className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">Analisando os dados...</span>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/6" />
          </div>
        )}

        {analysis && !isGenerating && (
          <div className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-violet-900 dark:prose-headings:text-violet-100 prose-p:text-violet-800 dark:prose-p:text-violet-200 prose-strong:text-violet-900 dark:prose-strong:text-violet-100 prose-ul:text-violet-800 dark:prose-ul:text-violet-200">
              <ReactMarkdown
                components={{
                  h3: ({ node, ...props }) => (
                    <h3 className="flex items-center gap-2 text-lg font-semibold mt-4 mb-2" {...props}>
                      {props.children?.toString().includes('Tendência') && <TrendingUp className="h-4 w-4" />}
                      {props.children?.toString().includes('Gargalo') && <AlertTriangle className="h-4 w-4" />}
                      {props.children?.toString().includes('Sugest') && <Lightbulb className="h-4 w-4" />}
                      {props.children}
                    </h3>
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc list-inside space-y-1" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="text-sm leading-relaxed" {...props} />
                  ),
                }}
              >
                {analysis}
              </ReactMarkdown>
            </div>
            
            <Button 
              onClick={handleGenerateAnalysis}
              variant="outline"
              size="sm"
              className="w-full border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900"
            >
              <Sparkles className="mr-2 h-3 w-3" />
              Gerar Nova Análise
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
