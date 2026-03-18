import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, AlertTriangle, GraduationCap, Ticket, Info } from "lucide-react";
import { usePersonas } from "@/hooks/usePersonas";
import { useDepartments } from "@/hooks/useDepartments";
import { useTicketCategories } from "@/hooks/useTicketCategories";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { RAGSourcesSection } from "./panels/RAGSourcesSection";
import { SmartCollectionSection } from "./panels/SmartCollectionSection";
import { BehaviorControlsSection } from "./panels/BehaviorControlsSection";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIResponsePropertiesPanelProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

export function AIResponsePropertiesPanel({
  selectedNode,
  updateNodeData,
}: AIResponsePropertiesPanelProps) {
  const { data: personas, isLoading: loadingPersonas } = usePersonas();

  // Personas ativas
  const activePersonas = personas?.filter((p) => p.is_active) || [];

  const handlePersonaChange = (personaId: string) => {
    if (personaId === "none") {
      updateNodeData("persona_id", null);
      updateNodeData("persona_name", null);
    } else {
      const persona = activePersonas.find((p) => p.id === personaId);
      updateNodeData("persona_id", personaId);
      updateNodeData("persona_name", persona?.name || null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 🆕 FASE 1: Seção de Controles de Comportamento (PRIMEIRO - mais importante) */}
      <BehaviorControlsSection
        selectedNode={selectedNode}
        updateNodeData={updateNodeData}
      />

      <Separator />

      {/* Seção: Persona */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-pink-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">Agente / Persona</Label>
        </div>
        
        {loadingPersonas ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={selectedNode.data.persona_id || "none"}
            onValueChange={handlePersonaChange}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Usar regras de roteamento" />
            </SelectTrigger>
            <SelectContent 
              position="popper" 
              side="bottom" 
              align="start"
              sideOffset={4}
              className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
            >
              <SelectItem value="none">
                <span className="text-muted-foreground">Usar regras de roteamento (padrão)</span>
              </SelectItem>
              {activePersonas.map((persona) => (
                <SelectItem key={persona.id} value={persona.id}>
                  <div className="flex items-center gap-2">
                    <span>{persona.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1">
                      {persona.role}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {selectedNode.data.persona_name && (
          <p className="text-[11px] text-muted-foreground pl-1">
            ✓ Persona "{selectedNode.data.persona_name}" será usada neste nó
          </p>
        )}
      </div>

      <Separator />

      {/* Seção: Fontes de Dados RAG */}
      <RAGSourcesSection
        selectedNode={selectedNode}
        updateNodeData={updateNodeData}
      />

      <Separator />

      {/* Seção: Detectar Onboarding Incompleto */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-emerald-500" />
            <Label className="text-xs font-semibold uppercase tracking-wide">
              Detectar Onboarding
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">
                    A IA identifica se o cliente tem etapas pendentes de onboarding e direciona para continuar de onde parou.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Switch
            checked={selectedNode.data.onboarding_detection_enabled === true}
            onCheckedChange={(checked) => updateNodeData("onboarding_detection_enabled", checked)}
          />
        </div>
        {selectedNode.data.onboarding_detection_enabled && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded">
            🎓 Quando ativo, a IA verifica se o cliente tem onboarding incompleto e pode orientá-lo sobre os próximos passos.
          </p>
        )}
      </div>

      <Separator />

      {/* Seção: Coleta Inteligente */}
      <SmartCollectionSection
        selectedNode={selectedNode}
        updateNodeData={updateNodeData}
      />

      <Separator />

      {/* Seção: Contexto Adicional */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">Instruções Extras</Label>
        </div>
        
        <Textarea
          onKeyDown={(e) => e.stopPropagation()}
          value={selectedNode.data.context_prompt || ""}
          onChange={(e) => updateNodeData("context_prompt", e.target.value)}
          placeholder="Diga algo a mais para a IA seguir aqui..."
          rows={3}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Ex: "Foque em explicar o processo de saque" ou "Seja breve e objetivo"
        </p>
      </div>

      <Separator />

      {/* Seção: Fallback - 🆕 FASE 1: Obrigatório com indicador visual */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn(
            "h-4 w-4",
            selectedNode.data.fallback_message 
              ? "text-orange-500" 
              : "text-red-500 animate-pulse"
          )} />
          <Label className="text-xs font-semibold uppercase tracking-wide">
            Resposta quando não souber
          </Label>
          {!selectedNode.data.fallback_message && (
            <Badge variant="destructive" className="text-[9px] px-1.5">Obrigatório</Badge>
          )}
        </div>
        <Textarea
          onKeyDown={(e) => e.stopPropagation()}
          value={selectedNode.data.fallback_message || "No momento não tenho essa informação."}
          onChange={(e) => updateNodeData("fallback_message", e.target.value)}
          placeholder="Mensagem se a IA não conseguir responder..."
          rows={2}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          O que a IA diz quando não tem a informação
        </p>
      </div>
    </div>
  );
}
