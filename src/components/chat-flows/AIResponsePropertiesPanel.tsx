import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, AlertTriangle, GraduationCap, Ticket } from "lucide-react";
import { usePersonas } from "@/hooks/usePersonas";
import { useTicketCategories } from "@/hooks/useTicketCategories";
import { useDepartments } from "@/hooks/useDepartments";
import { useUsersByDepartment } from "@/hooks/useUsersByDepartment";
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
import { Info } from "lucide-react";

interface AIResponsePropertiesPanelProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

export function AIResponsePropertiesPanel({
  selectedNode,
  updateNodeData,
}: AIResponsePropertiesPanelProps) {
  const { data: personas, isLoading: loadingPersonas } = usePersonas();
  const { data: ticketCategories = [] } = useTicketCategories();
  const { data: departments = [] } = useDepartments({ activeOnly: true });
  
  const actionDeptId = selectedNode.data.action_data?.department_id;
  const { data: actionAgents = [] } = useUsersByDepartment(actionDeptId || undefined);

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

      {/* Seção: Ação ao Sair */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-violet-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">Ação ao Sair</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                Permite que a IA crie automaticamente um ticket ao finalizar o atendimento neste nó. Ideal para formalizar solicitações como saque, reembolso ou devolução.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          value={selectedNode.data.end_action || "none"}
          onValueChange={(v) => {
            updateNodeData("end_action", v === "none" ? null : v);
            if (v === "none") updateNodeData("action_data", null);
            else if (!selectedNode.data.action_data) {
              updateNodeData("action_data", {
                subject: "",
                description: "",
                category: "outro",
                priority: "medium",
                department_id: null,
                department_name: null,
                assigned_to: null,
                assigned_to_name: null,
                use_collected_data: true,
              });
            }
          }}
        >
          <SelectTrigger><SelectValue placeholder="Nenhuma ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="create_ticket">🎫 Criar Ticket</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Ative quando a IA precisar formalizar a solicitação do cliente em um ticket antes de encerrar (ex: saque, reembolso). O ticket será criado automaticamente com os dados coletados pela IA.
        </p>

        {selectedNode.data.end_action === "create_ticket" && selectedNode.data.action_data && (
          <div className="space-y-2 pl-2 border-l-2 border-violet-500/30">
            <div className="space-y-1">
              <Label className="text-[10px]">Assunto</Label>
              <Input
                value={selectedNode.data.action_data.subject || ""}
                onChange={(e) => updateNodeData("action_data", { ...selectedNode.data.action_data, subject: e.target.value })}
                placeholder="Assunto do ticket com {{variáveis}}"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Descrição</Label>
              <Textarea
                onKeyDown={(e) => e.stopPropagation()}
                value={selectedNode.data.action_data.description || ""}
                onChange={(e) => updateNodeData("action_data", { ...selectedNode.data.action_data, description: e.target.value })}
                placeholder="Descrição do ticket..."
                rows={2}
                className="resize-none text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Categoria</Label>
                <Select
                  value={selectedNode.data.action_data.category || "outro"}
                  onValueChange={(v) => updateNodeData("action_data", { ...selectedNode.data.action_data, category: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ticketCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                    {ticketCategories.length === 0 && (
                      <SelectItem value="outro" disabled>Nenhuma categoria</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Prioridade</Label>
                <Select
                  value={selectedNode.data.action_data.priority || "medium"}
                  onValueChange={(v) => updateNodeData("action_data", { ...selectedNode.data.action_data, priority: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Departamento</Label>
              <Select
                value={selectedNode.data.action_data.department_id || "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    updateNodeData("action_data", { ...selectedNode.data.action_data, department_id: null, department_name: null, assigned_to: null, assigned_to_name: null });
                  } else {
                    const dept = departments.find(d => d.id === v);
                    updateNodeData("action_data", { ...selectedNode.data.action_data, department_id: v, department_name: dept?.name || null, assigned_to: null, assigned_to_name: null });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem departamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem departamento</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedNode.data.action_data.department_id && (
              <div className="space-y-1">
                <Label className="text-[10px]">Responsável</Label>
                <Select
                  value={selectedNode.data.action_data.assigned_to || "none"}
                  onValueChange={(v) => {
                    if (v === "none") {
                      updateNodeData("action_data", { ...selectedNode.data.action_data, assigned_to: null, assigned_to_name: null });
                    } else {
                      const agent = actionAgents.find((a: any) => a.id === v);
                      updateNodeData("action_data", { ...selectedNode.data.action_data, assigned_to: v, assigned_to_name: agent?.full_name || null });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pool do departamento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável (pool)</SelectItem>
                    {actionAgents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.full_name || "Sem nome"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
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
