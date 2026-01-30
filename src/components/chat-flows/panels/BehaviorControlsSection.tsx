import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Shield,
  MessageSquareOff,
  ListX,
  Target,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BehaviorControlsSectionProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

export function BehaviorControlsSection({
  selectedNode,
  updateNodeData,
}: BehaviorControlsSectionProps) {
  const maxSentences = selectedNode.data.max_sentences ?? 3;
  const forbidQuestions = selectedNode.data.forbid_questions ?? true;
  const forbidOptions = selectedNode.data.forbid_options ?? true;
  const objective = selectedNode.data.objective || "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-purple-500" />
        <Label className="text-xs font-semibold uppercase tracking-wide">
          Controles de Comportamento
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                Defina o objetivo específico da IA neste ponto do fluxo e restrinja 
                comportamentos indesejados para garantir respostas determinísticas.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Objetivo do Nó */}
      <div className="space-y-2 p-3 rounded-lg border bg-purple-500/5 border-purple-500/20">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-purple-500" />
          <Label className="text-sm font-medium">Objetivo da IA</Label>
        </div>
        
        <Textarea
          value={objective}
          onChange={(e) => updateNodeData("objective", e.target.value)}
          placeholder="Ex: Responder dúvidas sobre rastreio de pedidos"
          rows={2}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          A IA responderá SOMENTE sobre este objetivo específico.
        </p>
      </div>

      {/* Máximo de Frases */}
      <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Máximo de Frases</Label>
          <Badge variant="secondary" className="text-xs px-2">
            {maxSentences} {maxSentences === 1 ? 'frase' : 'frases'}
          </Badge>
        </div>
        
        <Slider
          value={[maxSentences]}
          onValueChange={(value) => updateNodeData("max_sentences", value[0])}
          min={1}
          max={5}
          step={1}
          className="w-full"
        />
        
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Muito curta</span>
          <span>Detalhada</span>
        </div>
      </div>

      {/* Restrições de Comportamento */}
      <div className="space-y-3 p-3 rounded-lg border bg-red-500/5 border-red-500/20">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Restrições Anti-Alucinação
        </Label>

        {/* Proibir Perguntas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareOff className="h-4 w-4 text-red-400" />
            <div>
              <Label className="text-sm font-medium">Proibir Perguntas</Label>
              <p className="text-[10px] text-muted-foreground">
                IA não pode fazer perguntas ao cliente
              </p>
            </div>
          </div>
          <Switch
            checked={forbidQuestions}
            onCheckedChange={(checked) => updateNodeData("forbid_questions", checked)}
          />
        </div>

        {/* Proibir Opções */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListX className="h-4 w-4 text-red-400" />
            <div>
              <Label className="text-sm font-medium">Proibir Opções</Label>
              <p className="text-[10px] text-muted-foreground">
                IA não pode oferecer múltipla escolha
              </p>
            </div>
          </div>
          <Switch
            checked={forbidOptions}
            onCheckedChange={(checked) => updateNodeData("forbid_options", checked)}
          />
        </div>

        {/* Status das Restrições */}
        <div className="flex flex-wrap gap-1 pt-1">
          {forbidQuestions && (
            <Badge variant="destructive" className="text-[10px] px-1.5">
              Sem perguntas
            </Badge>
          )}
          {forbidOptions && (
            <Badge variant="destructive" className="text-[10px] px-1.5">
              Sem opções
            </Badge>
          )}
          {!forbidQuestions && !forbidOptions && (
            <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">
              Sem restrições ativas
            </Badge>
          )}
        </div>
      </div>

      {/* Garantias */}
      <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded space-y-1">
        <p>✓ IA responde apenas ao objetivo definido</p>
        <p>✓ Respostas curtas e objetivas</p>
        <p>✓ Sem alucinações ou fugas de comportamento</p>
        <p>✓ Fallback seguro quando sem informação</p>
      </div>
    </div>
  );
}
