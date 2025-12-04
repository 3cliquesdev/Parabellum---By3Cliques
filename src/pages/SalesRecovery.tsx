import { useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, Clock, Package, Play, RefreshCcw, Search, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RecoveryResult {
  found: number;
  processed: number;
  alreadyDone: number;
  errors: number;
}

export default function SalesRecovery() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [progress, setProgress] = useState(0);

  const { data: products = [] } = useProducts();
  const { toast } = useToast();

  const handleRecover = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke("recover-sales", {
        body: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          productId: selectedProductId === "all" ? null : selectedProductId,
        },
      });

      if (error) throw error;

      setResult(data);
      setProgress(100);
      
      toast({
        title: "Resgate concluído",
        description: `${data.processed} novos onboardings iniciados de ${data.found} vendas encontradas.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro no resgate",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Máquina do Tempo
          </h1>
          <p className="text-muted-foreground">
            Resgate vendas da Kiwify e inicie onboardings retroativamente
          </p>
        </div>

        <div className="grid gap-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Filtros de Busca
              </CardTitle>
              <CardDescription>
                Selecione o período e produto para buscar vendas que não foram processadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Data Início */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Início</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Data Fim */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Fim</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Produto */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Produto</label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os produtos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleRecover}
                disabled={isProcessing}
                className="w-full gap-2"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <RefreshCcw className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Buscar e Processar Vendas Faltantes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Progresso */}
          {isProcessing && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processando vendas...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultado */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Resultado do Resgate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold text-primary">{result.found}</p>
                    <p className="text-sm text-muted-foreground">Vendas Encontradas</p>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{result.processed}</p>
                    <p className="text-sm text-muted-foreground">Novos Onboardings</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold">{result.alreadyDone}</p>
                    <p className="text-sm text-muted-foreground">Já Processados</p>
                  </div>
                  <div className="text-center p-4 bg-red-500/10 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">{result.errors}</p>
                    <p className="text-sm text-muted-foreground">Erros</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Como funciona?</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>O sistema busca todas as vendas pagas no período selecionado</li>
                    <li>Verifica quais clientes já têm onboarding iniciado</li>
                    <li>Para os que não têm, cria o contato e inicia o playbook automaticamente</li>
                    <li>Use para corrigir falhas de webhook ou importar alunos antigos</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
