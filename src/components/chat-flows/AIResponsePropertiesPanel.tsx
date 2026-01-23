import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot, BookOpen, Sparkles } from "lucide-react";
import { usePersonas } from "@/hooks/usePersonas";
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface AIResponsePropertiesPanelProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

export function AIResponsePropertiesPanel({
  selectedNode,
  updateNodeData,
}: AIResponsePropertiesPanelProps) {
  const { data: personas, isLoading: loadingPersonas } = usePersonas();
  const { data: kbCategories, isLoading: loadingCategories } = useKnowledgeCategories();

  // Personas ativas
  const activePersonas = personas?.filter((p) => p.is_active) || [];
  
  // Categorias selecionadas atualmente
  const selectedCategories: string[] = selectedNode.data.kb_categories || [];
  
  const handleCategoryToggle = (category: string) => {
    const current = selectedNode.data.kb_categories || [];
    const newCategories = current.includes(category)
      ? current.filter((c: string) => c !== category)
      : [...current, category];
    updateNodeData("kb_categories", newCategories);
  };

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
          <Label className="text-xs font-semibold">Agente / Persona</Label>
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
            <SelectContent>
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

      {/* Seção: Base de Conhecimento */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-500" />
          <Label className="text-xs font-semibold">Base de Conhecimento</Label>
        </div>
        
        <div className="flex items-center justify-between py-1">
          <Label className="text-xs text-muted-foreground">Usar KB para responder</Label>
          <Switch
            checked={selectedNode.data.use_knowledge_base !== false}
            onCheckedChange={(checked) => updateNodeData("use_knowledge_base", checked)}
          />
        </div>

        {selectedNode.data.use_knowledge_base !== false && (
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">
              Filtrar por categorias (vazio = todas):
            </Label>
            
            {loadingCategories ? (
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : kbCategories && kbCategories.length > 0 ? (
              <ScrollArea className="max-h-32">
                <div className="space-y-1.5 pr-2">
                  {kbCategories.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                    >
                      <Checkbox
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={() => handleCategoryToggle(category)}
                      />
                      <span className="truncate">{category}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">
                Nenhuma categoria encontrada na KB
              </p>
            )}

            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedCategories.map((cat) => (
                  <Badge
                    key={cat}
                    variant="secondary"
                    className="text-[10px] px-1.5 cursor-pointer hover:bg-destructive/20"
                    onClick={() => handleCategoryToggle(cat)}
                  >
                    {cat} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Seção: Contexto Adicional */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <Label className="text-xs font-semibold">Contexto Adicional</Label>
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
        <Label className="text-xs font-semibold">Mensagem de Fallback</Label>
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
