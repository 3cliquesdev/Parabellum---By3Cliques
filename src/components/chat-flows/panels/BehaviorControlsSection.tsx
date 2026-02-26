import { useState, useEffect } from "react";
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
  Info,
  LogOut,
  AlertTriangle,
  DollarSign,
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

function ExitKeywordsTextarea({ selectedNode, updateNodeData }: BehaviorControlsSectionProps) {
  const [exitText, setExitText] = useState(
    (selectedNode.data.exit_keywords || []).join("\n")
  );

  useEffect(() => {
    setExitText((selectedNode.data.exit_keywords || []).join("\n"));
  }, [selectedNode.id]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Palavras de saída</Label>
      <Textarea
        onKeyDown={(e) => e.stopPropagation()}
        value={exitText}
        onChange={(e) => setExitText(e.target.value)}
        onBlur={() => {
          const keywords = exitText.split("\n").map((k: string) => k.trim()).filter(Boolean);
          updateNodeData("exit_keywords", keywords);
        }}
        placeholder={"falar com atendente\nencerrar\nhumano"}
        rows={4}
        className="resize-y text-sm min-h-[80px] max-h-[200px] overflow-y-auto"
      />
      <p className="text-[10px] text-muted-foreground">
        Uma por linha. Se o cliente digitar uma dessas, o fluxo avança.
      </p>
    </div>
  );
}

export function BehaviorControlsSection({
  selectedNode,
  updateNodeData,
}: BehaviorControlsSectionProps) {
  const maxSentences = selectedNode.data.max_sentences ?? 3;
  const forbidQuestions = selectedNode.data.forbid_questions ?? true;
  const forbidOptions = selectedNode.data.forbid_options ?? true;
  const forbidFinancial = selectedNode.data.forbid_financial ?? false;
  const objective = selectedNode.data.objective || "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-purple-500" />
        <Label className="text-xs font-semibold uppercase tracking-wide">
          Como a IA deve responder
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                Configure como a IA vai se comportar neste ponto do fluxo.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Objetivo do Nó */}
      <div className="space-y-2 p-3 rounded-lg border bg-purple-500/5 border-purple-500/20">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-purple-500" />
          <Label className="text-sm font-medium">O que a IA deve fazer aqui</Label>
        </div>
        
        <Textarea
          onKeyDown={(e) => e.stopPropagation()}
          value={objective}
          onChange={(e) => updateNodeData("objective", e.target.value)}
          placeholder="Ex: Tirar dúvidas sobre entrega do pedido"
          rows={2}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          A IA só vai falar sobre esse assunto.
        </p>
      </div>

      {/* Máximo de Frases */}
      <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Tamanho da resposta</Label>
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
          O que a IA NÃO pode fazer
        </Label>

        {/* Não fazer perguntas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareOff className="h-4 w-4 text-red-400" />
            <div>
              <Label className="text-sm font-medium">Não fazer perguntas</Label>
              <p className="text-[10px] text-muted-foreground">
                A IA só responde, não pergunta nada
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
              <Label className="text-sm font-medium">Não dar opções numeradas</Label>
              <p className="text-[10px] text-muted-foreground">
                A IA não oferece lista de opções (1, 2, 3...)
              </p>
            </div>
          </div>
          <Switch
            checked={forbidOptions}
            onCheckedChange={(checked) => updateNodeData("forbid_options", checked)}
          />
        </div>

        {/* Não resolver financeiro */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-red-400" />
            <div>
              <Label className="text-sm font-medium">Não resolver assuntos financeiros</Label>
              <p className="text-[10px] text-muted-foreground">
                A IA transfere para humano ao detectar saque, reembolso ou devolução
              </p>
            </div>
          </div>
          <Switch
            checked={forbidFinancial}
            onCheckedChange={(checked) => updateNodeData("forbid_financial", checked)}
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
          {forbidFinancial && (
            <Badge variant="destructive" className="text-[10px] px-1.5">
              💰 Sem financeiro
            </Badge>
          )}
          {!forbidQuestions && !forbidOptions && !forbidFinancial && (
            <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">
              Sem restrições ativas
            </Badge>
          )}
        </div>
      </div>

      {/* 🆕 Seção: Quando sair da IA */}
      <div className="space-y-3 p-3 rounded-lg border bg-indigo-500/5 border-indigo-500/20">
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-indigo-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">
            Quando sair da IA
          </Label>
        </div>

        <ExitKeywordsTextarea
          selectedNode={selectedNode}
          updateNodeData={updateNodeData}
        />

        {/* Máximo de interações */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Máximo de interações</Label>
            <Badge variant="secondary" className="text-xs px-2">
              {(selectedNode.data.max_ai_interactions ?? 0) === 0
                ? "Sem limite"
                : `${selectedNode.data.max_ai_interactions} msgs`}
            </Badge>
          </div>

          <Slider
            value={[selectedNode.data.max_ai_interactions ?? 0]}
            onValueChange={(value) => updateNodeData("max_ai_interactions", value[0])}
            min={0}
            max={50}
            step={1}
            className="w-full"
          />

          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sem limite</span>
            <span>50 msgs</span>
          </div>
        </div>

        {/* Alerta: sem condição de saída */}
        {(selectedNode.data.max_ai_interactions ?? 0) === 0 &&
          (!selectedNode.data.exit_keywords || selectedNode.data.exit_keywords.length === 0) && (
          <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-yellow-700">
              Sem condição de saída configurada. A IA vai responder indefinidamente até o cliente sair do fluxo manualmente.
            </p>
          </div>
        )}
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
