import { useCallback, useState, useRef, useMemo, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowInstance,
  ReactFlowProvider,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, User, Mail, Phone, CreditCard, ListChecks, 
  MessageCircle, GitBranch, Sparkles, UserPlus, CheckCircle,
  Save, X, Trash2, Plus, Play, Bot, BookOpen, Package, ShieldCheck, KeyRound, Ticket
} from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DraggableBlock } from "@/components/playbook/DraggableBlock";
import { ButtonEdge } from "@/components/playbook/ButtonEdge";
import {
  MessageNode,
  AskNameNode,
  AskEmailNode,
  AskPhoneNode,
  AskCpfNode,
  AskOptionsNode,
  AskTextNode,
  TransferNode,
  EndNode,
  AIResponseNode,
  ChatFlowConditionNode,
  FetchOrderNode,
  ValidateCustomerNode,
  VerifyCustomerOTPNode,
  CreateTicketNode,
} from "./nodes";
import { cn } from "@/lib/utils";
import { TransferPropertiesPanel } from "./TransferPropertiesPanel";
import { AIResponsePropertiesPanel } from "./AIResponsePropertiesPanel";
import { FetchOrderPropertiesPanel } from "./FetchOrderPropertiesPanel";
import { ValidateCustomerPropertiesPanel } from "./ValidateCustomerPropertiesPanel";
import { VerifyCustomerOTPPropertiesPanel } from "./VerifyCustomerOTPPropertiesPanel";
import { VariableAutocomplete } from "./VariableAutocomplete";
import { CONDITION_CONTACT_FIELDS, CONDITION_CONVERSATION_FIELDS, getAncestorNodeIds } from "./variableCatalog";

// Tipos de nós para chat flows
export const chatFlowNodeTypes = {
  message: MessageNode,
  ask_name: AskNameNode,
  ask_email: AskEmailNode,
  ask_phone: AskPhoneNode,
  ask_cpf: AskCpfNode,
  ask_options: AskOptionsNode,
  ask_text: AskTextNode,
  condition: ChatFlowConditionNode,
  ai_response: AIResponseNode,
  transfer: TransferNode,
  end: EndNode,
  fetch_order: FetchOrderNode,
  validate_customer: ValidateCustomerNode,
  verify_customer_otp: VerifyCustomerOTPNode,
  create_ticket: CreateTicketNode,
};

const edgeTypes = {
  buttonEdge: ButtonEdge,
};

// Cores dos blocos por tipo
const blockColors: Record<string, string> = {
  message: "bg-slate-500",
  ask_name: "bg-blue-500",
  ask_email: "bg-cyan-500",
  ask_phone: "bg-green-500",
  ask_cpf: "bg-amber-500",
  ask_options: "bg-violet-500",
  ask_text: "bg-indigo-500",
  condition: "bg-purple-500",
  ai_response: "bg-pink-500",
  transfer: "bg-orange-500",
  end: "bg-emerald-500",
  fetch_order: "bg-teal-500",
  validate_customer: "bg-emerald-700",
  verify_customer_otp: "bg-purple-700",
  create_ticket: "bg-rose-500",
};

// Cores do MiniMap
const miniMapColors: Record<string, string> = {
  message: '#64748b',
  ask_name: '#3b82f6',
  ask_email: '#06b6d4',
  ask_phone: '#22c55e',
  ask_cpf: '#f59e0b',
  ask_options: '#8b5cf6',
  ask_text: '#6366f1',
  condition: '#a855f7',
  ai_response: '#ec4899',
  transfer: '#f97316',
  end: '#10b981',
  start: '#3b82f6',
  fetch_order: '#14b8a6',
  validate_customer: '#047857',
  verify_customer_otp: '#7e22ce',
  create_ticket: '#e11d48',
};

interface ChatFlowEditorProps {
  initialFlow?: { nodes: Node[]; edges: Edge[] };
  onSave: (flow: { nodes: Node[]; edges: Edge[] }) => void;
  onCancel: () => void;
  onFlowChange?: (flow: { nodes: Node[]; edges: Edge[] }) => void;
  isSaving?: boolean;
}

// Nó de início padrão
const createStartNode = (): Node => ({
  id: 'start',
  type: 'input',
  position: { x: 100, y: 200 },
  data: { label: '▶ Início' },
  className: 'bg-primary text-primary-foreground rounded-xl px-6 py-3 font-semibold shadow-lg border-2 border-primary',
  style: { 
    background: 'hsl(var(--primary))', 
    color: 'hsl(var(--primary-foreground))',
    borderRadius: '12px',
    fontWeight: 600,
  }
});

function ChatFlowEditorInner({ initialFlow, onSave, onCancel, onFlowChange, isSaving }: ChatFlowEditorProps) {
  // Criar nó de início se não houver nós
  const initialNodes = useMemo(() => {
    if (initialFlow?.nodes && initialFlow.nodes.length > 0) {
      return initialFlow.nodes;
    }
    return [createStartNode()];
  }, [initialFlow?.nodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow?.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Notificar mudanças no fluxo para o parent
  useEffect(() => {
    if (onFlowChange) {
      onFlowChange({ nodes, edges });
    }
  }, [nodes, edges, onFlowChange]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      type: 'buttonEdge',
      style: { strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
    }, eds)),
    [setEdges]
  );

  const defaultEdgeOptions = {
    type: 'buttonEdge',
    style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    animated: false,
  };

  const getDefaultData = (type: string) => {
    const defaults: Record<string, any> = {
      message: { label: "Mensagem", message: "" },
      ask_name: { label: "Perguntar Nome", message: "Qual seu nome completo?", save_as: "name", required: true },
      ask_email: { label: "Perguntar Email", message: "Qual seu email?", save_as: "email", required: true, validate: true },
      ask_phone: { label: "Perguntar Telefone", message: "Qual seu telefone?", save_as: "phone", required: true, validate: true },
      ask_cpf: { label: "Perguntar CPF", message: "Qual seu CPF?", save_as: "cpf", required: true, validate: true },
      ask_options: { label: "Múltipla Escolha", message: "Selecione uma opção:", save_as: "choice", options: [] },
      ask_text: { label: "Pergunta Aberta", message: "Digite sua resposta:", save_as: "response", required: false },
      condition: { label: "Condição", condition_type: "contains", condition_field: "", condition_value: "" },
      ai_response: { 
        label: "Resposta IA", 
        context_prompt: "", 
        use_knowledge_base: true, 
        // 🆕 FASE 1: fallback obrigatório com valor padrão
        fallback_message: "No momento não tenho essa informação.",
        // 🆕 FASE 1: Valores padrão para controles de comportamento
        max_sentences: 3,
        forbid_questions: true,
        forbid_options: true,
        forbid_financial: false,
        objective: ""
      },
      transfer: { label: "Transferir", message: "Transferindo para atendimento humano...", transfer_type: "department" },
      end: { label: "Fim", message: "Obrigado pelo contato!", end_action: "none" },
      fetch_order: { 
        label: "Buscar Pedido", 
        search_type: "auto", 
        source_variable: "", 
        save_found_as: "order_found",
        save_status_as: "order_status",
        save_packed_at_as: "packed_at_formatted"
      },
      validate_customer: {
        label: "Validar Cliente",
        validate_phone: true,
        validate_email: true,
        validate_cpf: false,
        save_validated_as: "customer_validated",
        save_customer_name_as: "customer_name_found",
        save_customer_email_as: "customer_email_found",
      },
      verify_customer_otp: {
        label: "Verificar Cliente + OTP",
        message_ask_email: "Para verificar sua identidade, me informe seu email cadastrado:",
        message_otp_sent: "Enviamos um código de 6 dígitos para {{email}}. Digite o código:",
        message_not_found: "Não encontramos este email em nossa base. O email está correto?",
        message_not_customer: "Vou encaminhar para nosso time comercial.",
        save_verified_as: "customer_verified",
        max_attempts: 3,
      },
      create_ticket: {
        label: "Criar Ticket",
        subject_template: "",
        description_template: "",
        ticket_category: "outro",
        ticket_priority: "medium",
      },
    };
    return defaults[type] || { label: `Novo ${type}` };
  };

  const addNode = (type: string, position?: { x: number; y: number }) => {
    const newNode: Node = {
      id: `${Date.now()}`,
      type,
      position: position || { x: Math.random() * 400 + 200, y: Math.random() * 300 },
      data: getDefaultData(type),
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
      addNode(type, position);
    },
    [reactFlowInstance]
  );

  const updateNodeData = (field: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, [field]: value } }
          : node
      )
    );
    setSelectedNode({
      ...selectedNode,
      data: { ...selectedNode.data, [field]: value }
    });

    // Auto-clean orphan edges when condition mode changes
    if (selectedNode.type === 'condition' && field === 'condition_rules') {
      const rules = value as Array<{ id: string }> | undefined;
      if (rules && rules.length > 0) {
        // Multi-rule mode: remove old true/false handles
        const validHandles = new Set([...rules.map(r => r.id), 'else']);
        setEdges((eds) => eds.filter(
          (e) => e.source !== selectedNode.id || !e.sourceHandle || validHandles.has(e.sourceHandle)
        ));
      } else {
        // Classic mode: remove rule_* and else handles
        setEdges((eds) => eds.filter(
          (e) => e.source !== selectedNode.id || !e.sourceHandle || ['true', 'false'].includes(e.sourceHandle)
        ));
      }
    }
  };

  const deleteNode = () => {
    if (!selectedNode) return;
    // Não permitir deletar o nó de início
    if (selectedNode.id === 'start') {
      toast.error("O nó de início não pode ser removido");
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter(
      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
    ));
    setSelectedNode(null);
  };

  const handleSave = () => {
    if (nodes.length <= 1) {
      toast.error("Adicione pelo menos um bloco além do início");
      return;
    }

    // Sanitizar e validar regras de condição antes de salvar
    const sanitizedNodes = nodes.map(node => {
      if (node.type !== 'condition' || !node.data.condition_rules?.length) return node;
      
      const rules = node.data.condition_rules.map((rule: any) => {
        // Auto-clear: se keywords === label, limpar keywords (motor usa label como fallback)
        const kw = (rule.keywords || "").trim();
        const lbl = (rule.label || "").trim();
        if (kw && kw === lbl) {
          return { ...rule, keywords: "" };
        }
        return rule;
      });

      // Validação: impedir keywords duplicadas não-vazias entre regras do mesmo nó
      const kwMap = new Map<string, number>();
      for (let i = 0; i < rules.length; i++) {
        const kw = (rules[i].keywords || "").trim();
        if (!kw) continue;
        if (kwMap.has(kw)) {
          toast.error(`Regras "${rules[kwMap.get(kw)!].label}" e "${rules[i].label}" têm keywords idênticas. Corrija antes de salvar.`);
          return null; // sinaliza erro
        }
        kwMap.set(kw, i);
      }

      return { ...node, data: { ...node.data, condition_rules: rules } };
    });

    // Se algum nó retornou null, houve erro de validação
    if (sanitizedNodes.includes(null)) return;

    onSave({ nodes: sanitizedNodes as Node[], edges });
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Não selecionar nó de início para edição
    if (node.id === 'start') {
      setSelectedNode(null);
      return;
    }
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Adicionar/remover opções para ask_options
  const addOption = () => {
    if (!selectedNode) return;
    const options = selectedNode.data.options || [];
    const newOption = { id: `opt_${Date.now()}`, label: "", value: "" };
    updateNodeData('options', [...options, newOption]);
  };

  const removeOption = (idx: number) => {
    if (!selectedNode) return;
    const options = [...(selectedNode.data.options || [])];
    const removedOption = options[idx];
    options.splice(idx, 1);
    updateNodeData('options', options);
    
    // Remover edges conectadas ao handle dessa opção
    if (removedOption?.id) {
      setEdges((eds) => eds.filter(
        (e) => !(e.source === selectedNode.id && e.sourceHandle === removedOption.id)
      ));
    }
  };

  const updateOption = (idx: number, field: string, value: string) => {
    if (!selectedNode) return;
    const options = [...(selectedNode.data.options || [])];
    options[idx] = { ...options[idx], [field]: value };
    updateNodeData('options', options);
  };

  // Adicionar/remover regras de condição (multi-rule)
  const addConditionRule = () => {
    if (!selectedNode) return;
    const rules = selectedNode.data.condition_rules || [];
    const newRule = { id: `rule_${Date.now()}`, label: "", keywords: "" };
    updateNodeData('condition_rules', [...rules, newRule]);
  };

  const removeConditionRule = (idx: number) => {
    if (!selectedNode) return;
    const rules = [...(selectedNode.data.condition_rules || [])];
    const removed = rules[idx];
    rules.splice(idx, 1);
    updateNodeData('condition_rules', rules);
    // Remover edges conectadas ao handle dessa regra
    if (removed?.id) {
      setEdges((eds) => eds.filter(
        (e) => !(e.source === selectedNode.id && e.sourceHandle === removed.id)
      ));
    }
  };

  const updateConditionRule = (idx: number, field: string, value: string) => {
    if (!selectedNode) return;
    const rules = [...(selectedNode.data.condition_rules || [])];
    rules[idx] = { ...rules[idx], [field]: value };
    updateNodeData('condition_rules', rules);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar esquerda - Blocos categorizados */}
      <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-4 border-b bg-card">
          <h3 className="font-semibold text-sm">Blocos</h3>
          <p className="text-xs text-muted-foreground">Arraste para o canvas</p>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Coleta de Dados */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Coleta de Dados
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <DraggableBlock type="ask_name" icon={User} label="Nome" color={blockColors.ask_name} />
                <DraggableBlock type="ask_email" icon={Mail} label="Email" color={blockColors.ask_email} />
                <DraggableBlock type="ask_phone" icon={Phone} label="Telefone" color={blockColors.ask_phone} />
                <DraggableBlock type="ask_cpf" icon={CreditCard} label="CPF" color={blockColors.ask_cpf} />
              </div>
            </div>

            {/* Interação */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                Interação
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <DraggableBlock type="message" icon={MessageSquare} label="Mensagem" color={blockColors.message} />
                <DraggableBlock type="ask_options" icon={ListChecks} label="Opções" color={blockColors.ask_options} />
                <DraggableBlock type="ask_text" icon={MessageCircle} label="Texto" color={blockColors.ask_text} />
              </div>
            </div>

            {/* Lógica */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Lógica
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <DraggableBlock type="condition" icon={GitBranch} label="Condição" color={blockColors.condition} />
                <DraggableBlock type="ai_response" icon={Sparkles} label="IA" color={blockColors.ai_response} />
                <DraggableBlock type="fetch_order" icon={Package} label="Pedido" color={blockColors.fetch_order} />
                <DraggableBlock type="validate_customer" icon={ShieldCheck} label="Validar Cliente" color={blockColors.validate_customer} />
                <DraggableBlock type="verify_customer_otp" icon={KeyRound} label="OTP Cliente" color={blockColors.verify_customer_otp} />
                <DraggableBlock type="create_ticket" icon={Ticket} label="Ticket" color={blockColors.create_ticket} />
              </div>
            </div>

            {/* Ações Finais */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Ações Finais
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <DraggableBlock type="transfer" icon={UserPlus} label="Transferir" color={blockColors.transfer} />
                <DraggableBlock type="end" icon={CheckCircle} label="Fim" color={blockColors.end} />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Botões de ação */}
        <div className="p-4 border-t bg-card space-y-2">
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar Fluxo"}
          </Button>
          <Button variant="outline" onClick={onCancel} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </div>

      {/* Canvas central */}
      <div ref={reactFlowWrapper} className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onInit={setReactFlowInstance}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={chatFlowNodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          className="bg-background"
        >
          <Background 
            variant={BackgroundVariant.Dots}
            gap={20} 
            size={1}
            className="opacity-40"
          />
          <Controls 
            className="!bg-card !border !shadow-lg !rounded-lg"
            showInteractive={false}
          />
          <MiniMap
            nodeColor={(node) => miniMapColors[node.type || ''] || '#888'}
            maskColor="hsl(var(--background) / 0.2)"
            className="!bg-card !border !rounded-lg !shadow-lg"
          />
        </ReactFlow>
      </div>

      {/* Painel de propriedades direito (aparece quando seleciona nó) */}
      {selectedNode && (
        <div className="w-80 border-l bg-card flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Propriedades</h3>
              <p className="text-xs text-muted-foreground capitalize">{selectedNode.type?.replace('_', ' ')}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={deleteNode}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Nome do bloco */}
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do bloco</Label>
                <Input
                  value={selectedNode.data.label || ""}
                  onChange={(e) => updateNodeData("label", e.target.value)}
                />
              </div>

              {/* Mensagem (para a maioria dos nós) — com autocomplete de variáveis */}
              {["message", "ask_name", "ask_email", "ask_phone", "ask_cpf", "ask_options", "ask_text", "transfer", "end"].includes(selectedNode.type || "") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem</Label>
                  <VariableAutocomplete
                    value={selectedNode.data.message || ""}
                    onChange={(v) => updateNodeData("message", v)}
                    nodes={nodes}
                    edges={edges}
                    selectedNodeId={selectedNode.id}
                    placeholder="Digite {{ para inserir variáveis"
                    minHeight="80px"
                  />
                </div>
              )}

              {/* save_as para campos de coleta */}
              {["ask_name", "ask_email", "ask_phone", "ask_cpf", "ask_text", "ask_options"].includes(selectedNode.type || "") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Salvar como variável</Label>
                  <Input
                    value={selectedNode.data.save_as || ""}
                    onChange={(e) => updateNodeData("save_as", e.target.value)}
                    placeholder="nome_variavel"
                  />
                </div>
              )}

              {/* Validação toggle */}
              {["ask_email", "ask_phone", "ask_cpf"].includes(selectedNode.type || "") && (
                <div className="flex items-center justify-between py-2">
                  <Label className="text-xs">Validar formato</Label>
                  <Switch
                    checked={selectedNode.data.validate !== false}
                    onCheckedChange={(checked) => updateNodeData("validate", checked)}
                  />
                </div>
              )}

              {/* Opções para ask_options */}
              {selectedNode.type === "ask_options" && (
                <div className="space-y-3">
                  <Label className="text-xs">Opções de resposta</Label>
                  {(selectedNode.data.options || []).map((opt: any, idx: number) => (
                    <div key={opt.id} className="flex gap-2">
                      <Input
                        value={opt.label}
                        onChange={(e) => updateOption(idx, "label", e.target.value)}
                        placeholder="Rótulo"
                        className="flex-1 text-sm"
                      />
                      <Input
                        value={opt.value}
                        onChange={(e) => updateOption(idx, "value", e.target.value)}
                        placeholder="Valor"
                        className="flex-1 text-sm"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeOption(idx)} className="shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOption} className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar opção
                  </Button>
                </div>
              )}

              {/* Condição */}
              {selectedNode.type === "condition" && (() => {
                // Coletar variáveis save_as dos nós ancestrais no grafo (não array linear)
                const ancestorIds = getAncestorNodeIds(selectedNode.id, edges);
                const flowVariables = nodes
                  .filter((n: Node) => ancestorIds.has(n.id) && n.data?.save_as)
                  .map((n: Node) => ({
                    value: n.data.save_as as string,
                    label: `${n.data.save_as} (${n.data.label || n.type})`,
                  }));
                
                // Deduplicate
                const uniqueFlowVars = flowVariables.filter(
                  (v: { value: string }, i: number, arr: { value: string }[]) => arr.findIndex((x) => x.value === v.value) === i
                );

                const contactFields = CONDITION_CONTACT_FIELDS;
                const conversationFields = CONDITION_CONVERSATION_FIELDS;

                const currentField = selectedNode.data.condition_field || "";
                const isCustomField = currentField && 
                  !uniqueFlowVars.some((v: { value: string }) => v.value === currentField) && 
                  !contactFields.some(f => f.value === currentField) && 
                  !conversationFields.some(f => f.value === currentField) &&
                  currentField !== "__message__";

                const conditionType = selectedNode.data.condition_type || "contains";
                const hideValueField = conditionType === "has_data" || conditionType === "not_has_data" || conditionType === "inactivity";
                const isInactivity = conditionType === "inactivity";

                return (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de condição</Label>
                    <Select
                      value={conditionType}
                      onValueChange={(v) => updateNodeData("condition_type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contém</SelectItem>
                        <SelectItem value="equals">É igual a</SelectItem>
                        <SelectItem value="has_data">Tem dado</SelectItem>
                        <SelectItem value="not_has_data">Não tem dado</SelectItem>
                        <SelectItem value="greater_than">Maior que</SelectItem>
                        <SelectItem value="less_than">Menor que</SelectItem>
                        <SelectItem value="regex">Regex</SelectItem>
                        <SelectItem value="inactivity">⏱ Tempo de inatividade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isInactivity && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Minutos sem resposta</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={selectedNode.data.condition_value || ""}
                        onChange={(e) => updateNodeData("condition_value", e.target.value)}
                        placeholder="Ex: 5"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Se o cliente não responder em X minutos, segue pelo caminho "Sim" (inativo). Se responder antes, segue pelo "Não".
                      </p>
                    </div>
                  )}
                  {!isInactivity && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Campo a verificar</Label>
                    <Select
                      value={isCustomField ? "__custom__" : (currentField || "__message__")}
                      onValueChange={(v) => {
                        if (v === "__custom__") {
                          updateNodeData("condition_field", "");
                        } else if (v === "__message__") {
                          updateNodeData("condition_field", "");
                        } else {
                          updateNodeData("condition_field", v.trim());
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o campo" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueFlowVars.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Variáveis do Fluxo</SelectLabel>
                            {uniqueFlowVars.map((v: { value: string; label: string }) => (
                              <SelectItem key={`flow-${v.value}`} value={v.value}>
                                💾 {v.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        <SelectGroup>
                          <SelectLabel>Campos do Contato</SelectLabel>
                          {contactFields.map(f => (
                            <SelectItem key={`contact-${f.value}`} value={f.value}>
                              👤 {f.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Campos da Conversa</SelectLabel>
                          {conversationFields.map(f => (
                            <SelectItem key={`conv-${f.value}`} value={f.value}>
                              📡 {f.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Especial</SelectLabel>
                          <SelectItem value="__message__">💬 Mensagem do usuário</SelectItem>
                          <SelectItem value="__custom__">✏️ Personalizado...</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                  {!isInactivity && (isCustomField || (currentField === "" && selectedNode.data.condition_field !== undefined && selectedNode.data.condition_field !== "")) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome do campo personalizado</Label>
                      <Input
                        value={selectedNode.data.condition_field || ""}
                        onChange={(e) => updateNodeData("condition_field", e.target.value)}
                        placeholder="nome_variavel"
                      />
                    </div>
                  )}
                  {!hideValueField && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor esperado</Label>
                      {(selectedNode.data.condition_type === "contains" || selectedNode.data.condition_type === "equals") ? (
                        <>
                        <Textarea
                            onKeyDown={(e) => e.stopPropagation()}
                            value={selectedNode.data.condition_value || ""}
                            onChange={(e) => updateNodeData("condition_value", e.target.value)}
                            placeholder="Separe múltiplos valores por vírgula"
                            className="min-h-[60px] text-sm"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Use vírgula para verificar múltiplos valores (qualquer um = verdadeiro)
                          </p>
                        </>
                      ) : (
                        <Input
                          value={selectedNode.data.condition_value || ""}
                          onChange={(e) => updateNodeData("condition_value", e.target.value)}
                        />
                      )}
                    </div>
                  )}

                  {/* === MULTI-REGRA (condition_rules) === */}
                  <div className="border-t pt-3 mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Múltiplos caminhos</Label>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={addConditionRule}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Regra
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      O nome da regra é usado como condição. Opcionalmente, adicione frases extras no campo abaixo. Se nenhuma bater, segue por "Outros".
                    </p>
                    {(selectedNode.data.condition_rules || []).length > 0 && (
                      <p className="text-[10px] text-warning font-medium">
                        ⚠ Modo multi-regra ativo — as saídas Sim/Não são substituídas pelas regras abaixo.
                      </p>
                    )}
                    {(selectedNode.data.condition_rules || []).map((rule: any, idx: number) => (
                      <div key={rule.id} className="border rounded-md p-2 space-y-1.5 bg-muted/30">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'][idx % 8] }}
                          />
                          <Input
                            value={rule.label || ""}
                            onChange={(e) => updateConditionRule(idx, "label", e.target.value)}
                            placeholder={`Regra ${idx + 1} (ex: Preço)`}
                            className="h-7 text-xs flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => removeConditionRule(idx)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Textarea
                          onKeyDown={(e) => e.stopPropagation()}
                          value={rule.keywords || ""}
                          onChange={(e) => updateConditionRule(idx, "keywords", e.target.value)}
                          placeholder="Opcional: frases extras (1 por linha). Se vazio, usa o nome da regra acima."
                          className="min-h-[40px] text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}

              {/* IA Response */}
              {selectedNode.type === "ai_response" && (
                <AIResponsePropertiesPanel
                  selectedNode={selectedNode}
                  updateNodeData={updateNodeData}
                />
              )}

              {/* Transfer */}
              {selectedNode.type === "transfer" && (
                <TransferPropertiesPanel
                  selectedNode={selectedNode}
                  updateNodeData={updateNodeData}
                />
              )}

              {/* End action */}
              {selectedNode.type === "end" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Ação ao finalizar</Label>
                  <Select
                    value={selectedNode.data.end_action || "none"}
                    onValueChange={(v) => updateNodeData("end_action", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Apenas finalizar</SelectItem>
                      <SelectItem value="create_lead">Criar lead</SelectItem>
                      <SelectItem value="create_ticket">Criar ticket</SelectItem>
                      <SelectItem value="add_tag">Adicionar tag</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Tag config when end_action = add_tag */}
                  {selectedNode.data.end_action === "add_tag" && (
                    <div className="space-y-3 mt-3 border-t pt-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Escopo da tag</Label>
                        <Select
                          value={selectedNode.data.action_data?.tag_scope || "contact"}
                          onValueChange={(v) => updateNodeData("action_data", { ...selectedNode.data.action_data, tag_scope: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contact">👤 Contato</SelectItem>
                            <SelectItem value="conversation">💬 Conversa</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          "Contato" aplica a tag no cadastro do cliente. "Conversa" aplica apenas nesta conversa.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tag</Label>
                        <Input
                          value={selectedNode.data.action_data?.tag_name || ""}
                          onChange={(e) => updateNodeData("action_data", { ...selectedNode.data.action_data, tag_name: e.target.value })}
                          placeholder="Nome da tag (ex: 9.98)"
                          className="text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Digite o nome exato da tag cadastrada no sistema.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">ID da Tag</Label>
                        <Input
                          value={selectedNode.data.action_data?.tag_id || ""}
                          onChange={(e) => updateNodeData("action_data", { ...selectedNode.data.action_data, tag_id: e.target.value })}
                          placeholder="UUID da tag"
                          className="text-sm font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Ticket config when end_action = create_ticket */}
                  {selectedNode.data.end_action === "create_ticket" && (
                    <div className="space-y-3 mt-3 border-t pt-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Assunto do ticket</Label>
                        <VariableAutocomplete
                          value={selectedNode.data.subject_template || ""}
                          onChange={(v) => updateNodeData("subject_template", v)}
                          nodes={nodes}
                          edges={edges}
                          selectedNodeId={selectedNode.id}
                          placeholder="Ex: Reclamação de {{nome}}"
                          minHeight="40px"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Descrição</Label>
                        <VariableAutocomplete
                          value={selectedNode.data.description_template || ""}
                          onChange={(v) => updateNodeData("description_template", v)}
                          nodes={nodes}
                          edges={edges}
                          selectedNodeId={selectedNode.id}
                          placeholder="Detalhes do ticket"
                          minHeight="60px"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Categoria</Label>
                        <Select
                          value={selectedNode.data.ticket_category || "outro"}
                          onValueChange={(v) => updateNodeData("ticket_category", v)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="financeiro">Financeiro</SelectItem>
                            <SelectItem value="tecnico">Técnico</SelectItem>
                            <SelectItem value="bug">Bug</SelectItem>
                            <SelectItem value="devolucao">Devolução</SelectItem>
                            <SelectItem value="reclamacao">Reclamação</SelectItem>
                            <SelectItem value="saque">Saque</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Prioridade</Label>
                        <Select
                          value={selectedNode.data.ticket_priority || "medium"}
                          onValueChange={(v) => updateNodeData("ticket_priority", v)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="urgent">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nota interna</Label>
                        <VariableAutocomplete
                          value={selectedNode.data.internal_note || ""}
                          onChange={(v) => updateNodeData("internal_note", v)}
                          nodes={nodes}
                          edges={edges}
                          selectedNodeId={selectedNode.id}
                          placeholder="Nota interna com {{variáveis}}"
                          minHeight="40px"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={selectedNode.data.use_collected_data || false}
                          onCheckedChange={(v) => updateNodeData("use_collected_data", v)}
                        />
                        <Label className="text-xs">Salvar dados coletados no ticket</Label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fetch Order */}
              {selectedNode.type === "fetch_order" && (
                <FetchOrderPropertiesPanel
                  selectedNode={selectedNode}
                  updateNodeData={updateNodeData}
                />
              )}

              {/* Validate Customer */}
              {selectedNode.type === "validate_customer" && (
                <ValidateCustomerPropertiesPanel
                  selectedNode={selectedNode}
                  updateNodeData={updateNodeData}
                />
              )}

              {/* Verify Customer OTP */}
              {selectedNode.type === "verify_customer_otp" && (
                <VerifyCustomerOTPPropertiesPanel
                  selectedNode={selectedNode}
                  updateNodeData={updateNodeData}
                />
              )}

              {/* Create Ticket */}
              {selectedNode.type === "create_ticket" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Assunto do ticket</Label>
                    <VariableAutocomplete
                      value={selectedNode.data.subject_template || ""}
                      onChange={(v) => updateNodeData("subject_template", v)}
                      nodes={nodes}
                      edges={edges}
                      selectedNodeId={selectedNode.id}
                      placeholder="Ex: Reclamação de {{nome}}"
                      minHeight="40px"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descrição</Label>
                    <VariableAutocomplete
                      value={selectedNode.data.description_template || ""}
                      onChange={(v) => updateNodeData("description_template", v)}
                      nodes={nodes}
                      edges={edges}
                      selectedNodeId={selectedNode.id}
                      placeholder="Detalhes do ticket com {{variáveis}}"
                      minHeight="80px"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Select
                      value={selectedNode.data.ticket_category || "outro"}
                      onValueChange={(v) => updateNodeData("ticket_category", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="financeiro">Financeiro</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="bug">Bug</SelectItem>
                        <SelectItem value="devolucao">Devolução</SelectItem>
                        <SelectItem value="reclamacao">Reclamação</SelectItem>
                        <SelectItem value="saque">Saque</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prioridade</Label>
                    <Select
                      value={selectedNode.data.ticket_priority || "medium"}
                      onValueChange={(v) => updateNodeData("ticket_priority", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nota interna</Label>
                    <VariableAutocomplete
                      value={selectedNode.data.internal_note || ""}
                      onChange={(v) => updateNodeData("internal_note", v)}
                      nodes={nodes}
                      edges={edges}
                      selectedNodeId={selectedNode.id}
                      placeholder="Nota interna com {{variáveis}}"
                      minHeight="40px"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={selectedNode.data.use_collected_data || false}
                      onCheckedChange={(v) => updateNodeData("use_collected_data", v)}
                    />
                    <Label className="text-xs">Salvar dados coletados no ticket</Label>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export function ChatFlowEditor(props: ChatFlowEditorProps) {
  return (
    <ReactFlowProvider>
      <ChatFlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
