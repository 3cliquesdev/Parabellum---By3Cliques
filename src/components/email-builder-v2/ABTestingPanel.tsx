import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  FlaskConical,
  Trophy,
  TrendingUp,
  Mail,
  MousePointer,
  AlertCircle,
} from "lucide-react";
import { useTemplateVariants, useCreateVariant } from "@/hooks/useEmailBuilderV2";
import { useToast } from "@/hooks/use-toast";

interface ABTestingPanelProps {
  templateId: string;
  abTestingEnabled: boolean;
  onToggleABTesting: (enabled: boolean) => void;
}

export function ABTestingPanel({
  templateId,
  abTestingEnabled,
  onToggleABTesting,
}: ABTestingPanelProps) {
  const { toast } = useToast();
  const { data: variants, isLoading } = useTemplateVariants(templateId);
  const createVariant = useCreateVariant();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newVariant, setNewVariant] = useState({
    name: "",
    subject: "",
    weight: 50,
  });

  const handleCreateVariant = async () => {
    if (!newVariant.name || !newVariant.subject) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e assunto da variante",
        variant: "destructive",
      });
      return;
    }

    try {
      await createVariant.mutateAsync({
        template_id: templateId,
        variant_name: newVariant.name,
        subject: newVariant.subject,
        weight_percent: newVariant.weight,
        is_control: (variants?.length || 0) === 0,
      });
      setCreateDialogOpen(false);
      setNewVariant({ name: "", subject: "", weight: 50 });
    } catch (error) {
      // Error handled by hook
    }
  };

  const calculateOpenRate = (opened: number, delivered: number) => {
    if (delivered === 0) return 0;
    return ((opened / delivered) * 100).toFixed(1);
  };

  const calculateClickRate = (clicked: number, opened: number) => {
    if (opened === 0) return 0;
    return ((clicked / opened) * 100).toFixed(1);
  };

  const getWinningVariant = () => {
    if (!variants || variants.length < 2) return null;
    
    const variantsWithMetrics = variants.map((v) => ({
      ...v,
      openRate: v.total_delivered ? (v.total_opened || 0) / v.total_delivered : 0,
      clickRate: v.total_opened ? (v.total_clicked || 0) / v.total_opened : 0,
    }));

    return variantsWithMetrics.reduce((prev, curr) => 
      curr.openRate > prev.openRate ? curr : prev
    );
  };

  const winningVariant = getWinningVariant();

  return (
    <div className="space-y-4">
      {/* Header Toggle */}
      <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Teste A/B</h3>
            <p className="text-sm text-muted-foreground">
              Compare diferentes versões do email
            </p>
          </div>
        </div>
        <Switch
          checked={abTestingEnabled}
          onCheckedChange={onToggleABTesting}
        />
      </div>

      {abTestingEnabled && (
        <>
          {/* Variants List */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  Carregando variantes...
                </div>
              ) : variants && variants.length > 0 ? (
                variants.map((variant) => {
                  const isWinner = winningVariant?.id === variant.id && variants.length > 1;
                  const openRate = calculateOpenRate(
                    variant.total_opened || 0,
                    variant.total_delivered || 0
                  );
                  const clickRate = calculateClickRate(
                    variant.total_clicked || 0,
                    variant.total_opened || 0
                  );

                  return (
                    <Card
                      key={variant.id}
                      className={`relative ${
                        isWinner ? "border-green-500/50 bg-green-500/5" : ""
                      }`}
                    >
                      {isWinner && (
                        <div className="absolute -top-2 -right-2">
                          <Badge className="bg-green-500 gap-1">
                            <Trophy className="h-3 w-3" />
                            Vencedor
                          </Badge>
                        </div>
                      )}
                      
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {variant.variant_name}
                            </CardTitle>
                            {variant.is_control && (
                              <Badge variant="outline" className="text-xs">
                                Controle
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary">
                            {variant.weight_percent}%
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Assunto: {variant.subject}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Metrics */}
                        <div className="grid grid-cols-4 gap-3 text-center">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <Mail className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                            <div className="text-lg font-bold">
                              {variant.total_sent || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Enviados
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <TrendingUp className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                            <div className="text-lg font-bold">
                              {variant.total_delivered || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Entregues
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <div className="text-lg font-bold text-green-500">
                              {openRate}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Aberturas
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <MousePointer className="h-4 w-4 mx-auto text-primary mb-1" />
                            <div className="text-lg font-bold text-primary">
                              {clickRate}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Cliques
                            </div>
                          </div>
                        </div>

                        {/* Weight Slider */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              Distribuição
                            </span>
                            <span className="font-medium">
                              {variant.weight_percent}%
                            </span>
                          </div>
                          <Progress value={variant.weight_percent || 0} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground text-center">
                      Nenhuma variante criada.
                      <br />
                      Crie pelo menos 2 variantes para iniciar o teste.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>

          {/* Add Variant Button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Adicionar Variante
          </Button>
        </>
      )}

      {/* Create Variant Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Variante</DialogTitle>
            <DialogDescription>
              Crie uma nova versão do email para testar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Variante</Label>
              <Input
                placeholder="Ex: Versão B - Urgência"
                value={newVariant.name}
                onChange={(e) =>
                  setNewVariant({ ...newVariant, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Assunto do Email</Label>
              <Input
                placeholder="Assunto alternativo..."
                value={newVariant.subject}
                onChange={(e) =>
                  setNewVariant({ ...newVariant, subject: e.target.value })
                }
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Peso da Distribuição</Label>
                <span className="text-sm font-medium">{newVariant.weight}%</span>
              </div>
              <Slider
                value={[newVariant.weight]}
                onValueChange={([value]) =>
                  setNewVariant({ ...newVariant, weight: value })
                }
                min={1}
                max={100}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Porcentagem de destinatários que receberão esta variante
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateVariant} disabled={createVariant.isPending}>
              {createVariant.isPending ? "Criando..." : "Criar Variante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
