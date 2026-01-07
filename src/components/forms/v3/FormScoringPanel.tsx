import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Target, 
  Trophy, 
  Flame, 
  Thermometer, 
  Snowflake,
  AlertTriangle,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormField, FormSchema } from "@/hooks/useForms";
import { ScoringRangesConfig } from "@/components/scoring/ScoringRangesConfig";
import { useScoringRanges } from "@/hooks/useScoringConfig";
import { ScoreBasedRoutingConfig } from "@/components/forms/ScoreBasedRoutingConfig";

interface FormScoringPanelProps {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
  formId?: string;
}

export default function FormScoringPanel({ schema, onSchemaChange, formId }: FormScoringPanelProps) {
  const fields = schema.fields || [];
  const { data: ranges = [] } = useScoringRanges();
  
  // Get fields with scoring enabled
  const scoringFields = fields.filter(f => f.scoring?.enabled);
  
  // Calculate max possible score
  const maxPossibleScore = scoringFields.reduce((total, field) => {
    const maxPoints = Math.max(...(field.scoring?.options?.map(o => o.points) || [0]));
    return total + maxPoints;
  }, 0);
  
  // Determine classification for max score
  const getClassificationForScore = (score: number) => {
    for (const range of ranges) {
      const minOk = score >= range.min_score;
      const maxOk = range.max_score === null || score <= range.max_score;
      if (minOk && maxOk) return range.classification;
    }
    return null;
  };
  
  const maxClassification = getClassificationForScore(maxPossibleScore);
  
  const classificationConfig = {
    quente: { icon: Flame, label: "Quente", color: "text-green-600", bg: "bg-green-500/10" },
    morno: { icon: Thermometer, label: "Morno", color: "text-amber-600", bg: "bg-amber-500/10" },
    frio: { icon: Snowflake, label: "Frio", color: "text-red-600", bg: "bg-red-500/10" },
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Scoring de Qualificação</h2>
          <p className="text-sm text-muted-foreground">
            Configure a pontuação de leads baseada nas respostas
          </p>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Campos com Scoring</p>
                <p className="text-2xl font-bold">{scoringFields.length}</p>
              </div>
              <Trophy className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pontuação Máxima</p>
                <p className="text-2xl font-bold">{maxPossibleScore} pts</p>
              </div>
              <Target className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Classificação Máxima</p>
                {maxClassification && classificationConfig[maxClassification as keyof typeof classificationConfig] ? (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const config = classificationConfig[maxClassification as keyof typeof classificationConfig];
                      const Icon = config.icon;
                      return (
                        <>
                          <Icon className={cn("h-5 w-5", config.color)} />
                          <span className="text-lg font-semibold">{config.label}</span>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-muted-foreground">-</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Alert if no scoring configured */}
      {scoringFields.length === 0 && (
        <Alert variant="default" className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            Nenhum campo tem scoring configurado. Vá para a aba <strong>Campos</strong> e ative o scoring nas perguntas que deseja pontuar.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Fields with Scoring */}
      {scoringFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campos com Scoring Ativo</CardTitle>
            <CardDescription>
              Pontuação configurada por campo e opção de resposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {scoringFields.map((field) => {
                const maxPoints = Math.max(...(field.scoring?.options?.map(o => o.points) || [0]));
                
                return (
                  <AccordionItem 
                    key={field.id} 
                    value={field.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <Badge variant="outline" className="capitalize">
                          {field.type}
                        </Badge>
                        <span className="font-medium">{field.label}</span>
                        <Badge variant="secondary" className="ml-auto mr-2">
                          máx {maxPoints} pts
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        {field.scoring?.options?.map((opt, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md"
                          >
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{opt.value}</span>
                            </div>
                            <Badge 
                              variant={opt.points > 0 ? "default" : "secondary"}
                              className={cn(
                                opt.points >= 10 && "bg-green-600",
                                opt.points >= 5 && opt.points < 10 && "bg-amber-600",
                                opt.points > 0 && opt.points < 5 && "bg-blue-600"
                              )}
                            >
                              {opt.points} pts
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
      
      {/* Scoring Ranges Configuration */}
      <ScoringRangesConfig />
      
      {/* Score-Based Routing Configuration */}
      <ScoreBasedRoutingConfig 
        formId={formId} 
        hasScoringFields={scoringFields.length > 0} 
      />
    </div>
  );
}
