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
  Save, X, Trash2, Plus, Play, Bot, BookOpen, Package
} from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "./nodes";
import { cn } from "@/lib/utils";
import { TransferPropertiesPanel } from "./TransferPropertiesPanel";
import { AIResponsePropertiesPanel } from "./AIResponsePropertiesPanel";
import { FetchOrderPropertiesPanel } from "./FetchOrderPropertiesPanel";

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
    onSave({ nodes, edges });
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

              {/* Mensagem (para a maioria dos nós) */}
              {["message", "ask_name", "ask_email", "ask_phone", "ask_cpf", "ask_options", "ask_text", "transfer", "end"].includes(selectedNode.type || "") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    value={selectedNode.data.message || ""}
                    onChange={(e) => updateNodeData("message", e.target.value)}
                    rows={3}
                    className="resize-none"
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
              {selectedNode.type === "condition" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de condição</Label>
                    <Select
                      value={selectedNode.data.condition_type || "contains"}
                      onValueChange={(v) => updateNodeData("condition_type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contém</SelectItem>
                        <SelectItem value="equals">É igual a</SelectItem>
                        <SelectItem value="has_data">Tem dado</SelectItem>
                        <SelectItem value="regex">Regex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Campo a verificar</Label>
                    <Input
                      value={selectedNode.data.condition_field || ""}
                      onChange={(e) => updateNodeData("condition_field", e.target.value)}
                      placeholder="nome_variavel"
                    />
                  </div>
                  {selectedNode.data.condition_type !== "has_data" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor esperado</Label>
                      <Input
                        value={selectedNode.data.condition_value || ""}
                        onChange={(e) => updateNodeData("condition_value", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

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
                </div>
              )}

              {/* Fetch Order */}
              {selectedNode.type === "fetch_order" && (
                <FetchOrderPropertiesPanel
                  selectedNode={selectedNode}
                  updateNodeData={updateNodeData}
                />
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
