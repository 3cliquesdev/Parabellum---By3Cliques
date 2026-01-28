import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, AlertTriangle } from "lucide-react";
import { usePersonas } from "@/hooks/usePersonas";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RAGSourcesSection } from "./panels/RAGSourcesSection";
import { SmartCollectionSection } from "./panels/SmartCollectionSection";

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

      {/* Seção: Fontes de Dados RAG (NOVO) */}
      <RAGSourcesSection
        selectedNode={selectedNode}
        updateNodeData={updateNodeData}
      />

      <Separator />

      {/* Seção: Coleta Inteligente (NOVO) */}
      <SmartCollectionSection
        selectedNode={selectedNode}
        updateNodeData={updateNodeData}
      />

      <Separator />

      {/* Seção: Contexto Adicional */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">Contexto Adicional</Label>
        </div>
        
        <Textarea
          value={selectedNode.data.context_prompt || ""}
          onChange={(e) => updateNodeData("context_prompt", e.target.value)}
          placeholder="Instruções adicionais para a IA responder neste ponto do fluxo..."
          rows={3}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Ex: "Foque em explicar o processo de saque" ou "Seja breve e objetivo"
        </p>
      </div>

      <Separator />

      {/* Seção: Fallback */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">Mensagem de Fallback</Label>
        </div>
        <Textarea
          value={selectedNode.data.fallback_message || ""}
          onChange={(e) => updateNodeData("fallback_message", e.target.value)}
          placeholder="Mensagem se a IA não conseguir responder..."
          rows={2}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          Exibida quando a IA não encontra resposta na KB selecionada
        </p>
      </div>
    </div>
  );
}
