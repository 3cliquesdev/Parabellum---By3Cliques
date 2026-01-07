import { useCallback, useState, useRef } from "react";
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Clock, CheckSquare, Phone, Save, X, GitBranch, UserCheck, Eye, HelpCircle, Plus, Trash2, Play, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EmailNode } from "./EmailNode";
import { DelayNode } from "./DelayNode";
import { TaskNode } from "./TaskNode";
import { CallNode } from "./CallNode";
import { ConditionNode } from "./ConditionNode";
import { ApprovalNode } from "./ApprovalNode";
import { ButtonEdge } from "./ButtonEdge";
import { FormNode } from "./FormNode";
import { DraggableBlock } from "./DraggableBlock";
import { RichTextEditor } from "./RichTextEditor";
import { VideoEmbedField } from "./VideoEmbedField";
import { AttachmentsUploader } from "./AttachmentsUploader";
import { PlaybookStepViewer } from "./PlaybookStepViewer";
import { PlaybookSimulator } from "./PlaybookSimulator";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useForms } from "@/hooks/useForms";
import { useScoringRanges } from "@/hooks/useScoringConfig";
import { Flame, Thermometer, Snowflake } from "lucide-react";
export const nodeTypes = {
  email: EmailNode,
  delay: DelayNode,
  task: TaskNode,
  call: CallNode,
  condition: ConditionNode,
  approval: ApprovalNode,
  form: FormNode,
};

const edgeTypes = {
  buttonEdge: ButtonEdge,
};

interface PlaybookEditorProps {
  initialFlow?: { nodes: Node[]; edges: Edge[] };
  onSave: (flow: { nodes: Node[]; edges: Edge[] }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

function PlaybookEditorInner({ initialFlow, onSave, onCancel, isSaving }: PlaybookEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow?.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [previewNode, setPreviewNode] = useState<Node | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { data: emailTemplates } = useEmailTemplates();
  const { data: forms } = useForms();
  const { data: scoringRanges = [] } = useScoringRanges();

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

  const addNode = (type: string, position?: { x: number; y: number }) => {
    const newNode: Node = {
      id: `${Date.now()}`,
      type,
      position: position || { x: Math.random() * 400, y: Math.random() * 300 },
      data: {
        label: `Novo ${type}`,
        ...(type === "email" && { subject: "Assunto do email" }),
        ...(type === "delay" && { duration_days: 1 }),
        ...(type === "task" && { 
          task_type: "task", 
          description: "Descrição da tarefa",
          rich_content: "",
          video_url: "",
          attachments: [],
          min_view_seconds: 10
        }),
        ...(type === "call" && { description: "Descrição da ligação" }),
        ...(type === "condition" && { condition_type: "email_opened", condition_value: "" }),
        ...(type === "approval" && { approver_role: "consultant", approval_message: "Revisar antes de continuar" }),
        ...(type === "form" && { form_id: "", form_name: "", pause_execution: true, timeout_days: 3 }),
      },
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
    
    // Update selectedNode state to reflect changes
    setSelectedNode({
      ...selectedNode,
      data: { ...selectedNode.data, [field]: value }
    });
  };

  const addQuizOption = () => {
    if (!selectedNode) return;
    const options = selectedNode.data.quiz_options || [];
    const newOption = {
      id: String.fromCharCode(97 + options.length), // a, b, c, d...
      text: ''
    };
    updateNodeData('quiz_options', [...options, newOption]);
  };

  const removeQuizOption = (index: number) => {
    if (!selectedNode) return;
    const options = [...(selectedNode.data.quiz_options || [])];
    options.splice(index, 1);
    updateNodeData('quiz_options', options);
  };

  const updateQuizOption = (index: number, text: string) => {
    if (!selectedNode) return;
    const options = [...(selectedNode.data.quiz_options || [])];
    options[index] = { ...options[index], text };
    updateNodeData('quiz_options', options);
  };

  const deleteNode = () => {
    if (!selectedNode) return;
    
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter(
      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
    ));
    setSelectedNode(null);
  };

  const handleSave = () => {
    onSave({ nodes, edges });
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  return (
    <>
      <div className="flex h-[600px] gap-4">
      {/* Sidebar de blocos */}
      <Card className="w-72 p-4 flex flex-col">
        <div className="space-y-3">
          {/* Simulate Flow Button */}
          <Button
            onClick={() => setSimulatorOpen(true)}
            variant="outline"
            className="w-full gap-2 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:bg-primary/10"
            disabled={nodes.length === 0}
          >
            <Play className="h-4 w-4" />
            ▶️ Simular Fluxo
          </Button>

          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            🧱 Blocos
          </h3>
          <p className="text-xs text-muted-foreground">
            Arraste e solte no canvas
          </p>
          <div className="grid grid-cols-2 gap-2">
            <DraggableBlock type="email" icon={Mail} label="Email" />
            <DraggableBlock type="delay" icon={Clock} label="Esperar" />
            <DraggableBlock type="task" icon={CheckSquare} label="Tarefa" />
            <DraggableBlock type="call" icon={Phone} label="Ligação" />
            <DraggableBlock type="condition" icon={GitBranch} label="Condição" />
            <DraggableBlock type="approval" icon={UserCheck} label="Aprovação" />
            <DraggableBlock type="form" icon={FileText} label="Formulário" />
          </div>
        </div>

        {/* Painel de propriedades */}
        {selectedNode && (
          <div className="mt-6 pt-6 border-t space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Propriedades</h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={deleteNode}
                className="text-destructive hover:text-destructive h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Editando: <span className="font-medium text-foreground">{selectedNode.data.label}</span>
            </p>
            <div>
              <Label>Nome</Label>
              <Input
                value={selectedNode.data.label}
                onChange={(e) => updateNodeData("label", e.target.value)}
              />
            </div>
            {selectedNode.type === "email" && (
              <>
                <div>
                  <Label>Template de Email</Label>
                  <Select
                    value={selectedNode.data.template_id || ""}
                    onValueChange={(value) => {
                      updateNodeData("template_id", value);
                      const template = emailTemplates?.find(t => t.id === value);
                      if (template) {
                        updateNodeData("subject", template.subject);
                        updateNodeData("label", template.name);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {emailTemplates?.filter(t => t.is_active).map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gerencie templates em Configurações → Templates de Email
                  </p>
                </div>
                <div>
                  <Label>Assunto (sobrescrever)</Label>
                  <Input
                    value={selectedNode.data.subject || ""}
                    onChange={(e) => updateNodeData("subject", e.target.value)}
                    placeholder="Será preenchido pelo template"
                  />
                </div>
              </>
            )}
            {selectedNode.type === "delay" && (
              <div>
                <Label>Dias de espera</Label>
                <Input
                  type="number"
                  value={selectedNode.data.duration_days || 1}
                  onChange={(e) => updateNodeData("duration_days", parseInt(e.target.value))}
                />
              </div>
            )}
            {selectedNode.type === "task" && (
              <>
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      ⏱️ Tempo Mínimo de Permanência (segundos)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={selectedNode.data.min_view_seconds ?? 10}
                      onChange={(e) => updateNodeData("min_view_seconds", parseInt(e.target.value) || 0)}
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      0 = Sem trava. O botão "Avançar" só libera após este tempo.
                    </p>
                  </div>

                  <VideoEmbedField
                    url={selectedNode.data.video_url || ""}
                    onChange={(value) => updateNodeData("video_url", value)}
                  />
                  
                  <div>
                    <Label className="mb-2 block">✍️ Conteúdo da Aula</Label>
                    <RichTextEditor
                      content={selectedNode.data.rich_content || ""}
                      onChange={(value) => updateNodeData("rich_content", value)}
                      placeholder="Escreva o conteúdo da aula com formatação rica..."
                    />
                  </div>

                  <AttachmentsUploader
                    attachments={selectedNode.data.attachments || []}
                    onChange={(value) => updateNodeData("attachments", value)}
                  />

                  {/* Quiz Gatekeeper Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-base font-semibold">
                        <HelpCircle className="h-4 w-4 text-primary" />
                        📝 Trava de Conhecimento (Quiz)
                      </Label>
                      <Switch
                        checked={selectedNode.data.quiz_enabled || false}
                        onCheckedChange={(checked) => {
                          updateNodeData("quiz_enabled", checked);
                          if (checked && !selectedNode.data.quiz_options) {
                            updateNodeData("quiz_options", []);
                          }
                        }}
                      />
                    </div>

                    {selectedNode.data.quiz_enabled && (
                      <div className="space-y-4 pl-6 border-l-2 border-primary/30">
                        {/* Pergunta */}
                        <div>
                          <Label>Pergunta do Quiz</Label>
                          <Input
                            value={selectedNode.data.quiz_question || ""}
                            onChange={(e) => updateNodeData("quiz_question", e.target.value)}
                            placeholder="O que você aprendeu nesta aula?"
                          />
                        </div>

                        {/* Opções de Resposta */}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Opções de Resposta</Label>
                          <RadioGroup
                            value={selectedNode.data.quiz_correct_option || ""}
                            onValueChange={(value) => updateNodeData("quiz_correct_option", value)}
                          >
                            {(selectedNode.data.quiz_options || []).map((option: any, idx: number) => (
                              <div key={option.id} className="flex items-center gap-2">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value={option.id} id={`quiz-${option.id}`} />
                                  <Label htmlFor={`quiz-${option.id}`} className="sr-only">
                                    Marcar como correta
                                  </Label>
                                </div>
                                <Input
                                  value={option.text}
                                  onChange={(e) => updateQuizOption(idx, e.target.value)}
                                  placeholder={`Opção ${option.id.toUpperCase()}`}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeQuizOption(idx)}
                                  disabled={(selectedNode.data.quiz_options || []).length <= 2}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </RadioGroup>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addQuizOption}
                            className="w-full"
                            disabled={(selectedNode.data.quiz_options || []).length >= 6}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Opção
                          </Button>

                          <p className="text-xs text-muted-foreground">
                            ✅ Clique no círculo ao lado da opção para marcá-la como correta
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setPreviewNode(selectedNode)}
                  >
                    <Eye className="h-4 w-4" />
                    👁️ Preview - Ver como Cliente
                  </Button>
                </div>
              </>
            )}
            {selectedNode.type === "call" && (
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={selectedNode.data.description || ""}
                  onChange={(e) => updateNodeData("description", e.target.value)}
                />
              </div>
            )}
            {selectedNode.type === "condition" && (
              <>
                <div>
                  <Label>Tipo de Condição</Label>
                  <Select
                    value={selectedNode.data.condition_type || "email_opened"}
                    onValueChange={(value) => {
                      updateNodeData("condition_type", value);
                      // Auto-preencher leadScoringTotal para form_score
                      if (value === "form_score" && !selectedNode.data.score_name) {
                        updateNodeData("score_name", "leadScoringTotal");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead_classification">🎯 Classificação de Lead</SelectItem>
                      <SelectItem value="form_score">📊 Score do Formulário</SelectItem>
                      <SelectItem value="email_opened">Email Aberto</SelectItem>
                      <SelectItem value="email_clicked">Email Clicado</SelectItem>
                      <SelectItem value="meeting_booked">Reunião Agendada</SelectItem>
                      <SelectItem value="tag_exists">Tag Existe</SelectItem>
                      <SelectItem value="status_change">Mudança de Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Lead Classification - Nova opção intuitiva */}
                {selectedNode.data.condition_type === "lead_classification" && (
                  <>
                    <div>
                      <Label>Formulário</Label>
                      <Select
                        value={selectedNode.data.score_form_id || ""}
                        onValueChange={(value) => {
                          const form = forms?.find(f => f.id === value);
                          updateNodeData("score_form_id", value);
                          updateNodeData("score_form_name", form?.name || "");
                        }}
                      >
                        <SelectTrigger className="bg-background text-foreground">
                          <SelectValue placeholder="Selecione o formulário..." />
                        </SelectTrigger>
                        <SelectContent className="z-[9999] bg-popover" sideOffset={5}>
                          {forms?.filter(f => f.is_active).map((form) => (
                            <SelectItem key={form.id} value={form.id}>
                              {form.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Mostrar faixas configuradas */}
                    {scoringRanges.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">📊 Faixas configuradas:</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {scoringRanges.map((range) => (
                            <span 
                              key={range.id} 
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
                              style={{ backgroundColor: `${range.color}20`, color: range.color }}
                            >
                              {range.classification === "quente" && <Flame className="h-3 w-3" />}
                              {range.classification === "morno" && <Thermometer className="h-3 w-3" />}
                              {range.classification === "frio" && <Snowflake className="h-3 w-3" />}
                              {range.classification}: {range.min_score}-{range.max_score ?? "∞"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <Label>Classificação Esperada</Label>
                      <RadioGroup
                        value={selectedNode.data.expected_classification || "quente"}
                        onValueChange={(value) => updateNodeData("expected_classification", value)}
                        className="mt-2 space-y-2"
                      >
                        <div className="flex items-center space-x-2 p-2 rounded border border-green-500/30 bg-green-500/5">
                          <RadioGroupItem value="quente" id="class-quente" />
                          <Label htmlFor="class-quente" className="flex items-center gap-2 cursor-pointer flex-1">
                            <Flame className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 font-medium">Quente</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {scoringRanges.find(r => r.classification === "quente")?.min_score ?? 31}+ pts
                            </span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 rounded border border-amber-500/30 bg-amber-500/5">
                          <RadioGroupItem value="morno" id="class-morno" />
                          <Label htmlFor="class-morno" className="flex items-center gap-2 cursor-pointer flex-1">
                            <Thermometer className="h-4 w-4 text-amber-600" />
                            <span className="text-amber-600 font-medium">Morno</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {scoringRanges.find(r => r.classification === "morno")?.min_score ?? 16}-{scoringRanges.find(r => r.classification === "morno")?.max_score ?? 30} pts
                            </span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 rounded border border-red-500/30 bg-red-500/5">
                          <RadioGroupItem value="frio" id="class-frio" />
                          <Label htmlFor="class-frio" className="flex items-center gap-2 cursor-pointer flex-1">
                            <Snowflake className="h-4 w-4 text-red-600" />
                            <span className="text-red-600 font-medium">Frio</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {scoringRanges.find(r => r.classification === "frio")?.min_score ?? 0}-{scoringRanges.find(r => r.classification === "frio")?.max_score ?? 15} pts
                            </span>
                          </Label>
                        </div>
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground mt-2">
                        ✓ Sim → Se o lead <strong>for</strong> essa classificação<br/>
                        ✗ Não → Se o lead <strong>não for</strong> essa classificação
                      </p>
                    </div>
                  </>
                )}
                
                {/* Form Score specific fields - Melhorado */}
                {selectedNode.data.condition_type === "form_score" && (
                  <>
                    <div>
                      <Label>Formulário</Label>
                      <Select
                        value={selectedNode.data.score_form_id || ""}
                        onValueChange={(value) => {
                          const form = forms?.find(f => f.id === value);
                          updateNodeData("score_form_id", value);
                          updateNodeData("score_form_name", form?.name || "");
                        }}
                      >
                        <SelectTrigger className="bg-background text-foreground">
                          <SelectValue placeholder="Selecione o formulário..." />
                        </SelectTrigger>
                        <SelectContent className="z-[9999] bg-popover" sideOffset={5}>
                          {forms?.filter(f => f.is_active).map((form) => (
                            <SelectItem key={form.id} value={form.id}>
                              {form.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Mostrar faixas configuradas */}
                    {scoringRanges.length > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">ℹ️ Faixas de referência:</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {scoringRanges.map((range) => (
                            <span 
                              key={range.id} 
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
                              style={{ backgroundColor: `${range.color}20`, color: range.color }}
                            >
                              {range.classification === "quente" && <Flame className="h-3 w-3" />}
                              {range.classification === "morno" && <Thermometer className="h-3 w-3" />}
                              {range.classification === "frio" && <Snowflake className="h-3 w-3" />}
                              {range.classification}: {range.min_score}-{range.max_score ?? "∞"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <Label>Nome do Score</Label>
                      <Input
                        value={selectedNode.data.score_name || "leadScoringTotal"}
                        onChange={(e) => updateNodeData("score_name", e.target.value)}
                        placeholder="leadScoringTotal"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use <code className="bg-muted px-1 rounded">leadScoringTotal</code> para o score padrão
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Operador</Label>
                        <Select
                          value={selectedNode.data.score_operator || "gte"}
                          onValueChange={(value) => updateNodeData("score_operator", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gt">&gt; Maior que</SelectItem>
                            <SelectItem value="gte">≥ Maior ou igual</SelectItem>
                            <SelectItem value="lt">&lt; Menor que</SelectItem>
                            <SelectItem value="lte">≤ Menor ou igual</SelectItem>
                            <SelectItem value="eq">= Igual a</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Threshold</Label>
                        <Input
                          type="number"
                          value={selectedNode.data.score_threshold ?? 0}
                          onChange={(e) => updateNodeData("score_threshold", parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </>
                )}
                
                {/* Standard condition value */}
                {selectedNode.data.condition_type !== "form_score" && 
                 selectedNode.data.condition_type !== "lead_classification" && (
                  <div>
                    <Label>Valor da Condição</Label>
                    <Input
                      value={selectedNode.data.condition_value || ""}
                      onChange={(e) => updateNodeData("condition_value", e.target.value)}
                      placeholder="Ex: nome do email, tag, etc"
                    />
                  </div>
                )}
              </>
            )}
            {selectedNode.type === "approval" && (
              <>
                <div>
                  <Label>Quem Aprova</Label>
                  <Select
                    value={selectedNode.data.approver_role || "consultant"}
                    onValueChange={(value) => updateNodeData("approver_role", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultant">Consultor</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mensagem de Aprovação</Label>
                  <Textarea
                    value={selectedNode.data.approval_message || ""}
                    onChange={(e) => updateNodeData("approval_message", e.target.value)}
                    placeholder="Mensagem a ser exibida ao aprovador..."
                  />
                </div>
              </>
            )}
            {selectedNode.type === "form" && (
              <>
                <div>
                  <Label>Formulário</Label>
                  <Select
                    value={selectedNode.data.form_id || ""}
                    onValueChange={(value) => {
                      const form = forms?.find(f => f.id === value);
                      updateNodeData("form_id", value);
                      updateNodeData("form_name", form?.name || "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o formulário..." />
                    </SelectTrigger>
                    <SelectContent>
                      {forms?.filter(f => f.is_active).map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Pausar até resposta</Label>
                  <Switch
                    checked={selectedNode.data.pause_execution ?? true}
                    onCheckedChange={(checked) => updateNodeData("pause_execution", checked)}
                  />
                </div>
                <div>
                  <Label>Timeout (dias)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={selectedNode.data.timeout_days ?? 3}
                    onChange={(e) => updateNodeData("timeout_days", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    0 = Sem timeout. Se o cliente não responder, continua após este tempo.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="mt-6 pt-6 border-t space-y-2">
          <Button onClick={handleSave} className="w-full gap-2" disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar Playbook"}
          </Button>
          <Button onClick={onCancel} variant="outline" className="w-full gap-2" disabled={isSaving}>
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </Card>

      {/* Canvas React Flow */}
      <div ref={reactFlowWrapper} className="flex-1 border rounded-lg overflow-hidden group">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onInit={setReactFlowInstance}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
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
            className="opacity-30"
          />
          <Controls 
            className="!bg-card !border !shadow-lg !rounded-lg"
            showInteractive={false}
          />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'email': return '#2563eb';
                case 'delay': return '#d97706';
                case 'task': return '#059669';
                case 'call': return '#7c3aed';
                case 'condition': return '#9333ea';
                case 'approval': return '#ea580c';
                default: return 'hsl(var(--primary))';
              }
            }}
            maskColor="hsl(var(--background) / 0.2)"
            className="!bg-card !border !rounded-lg !shadow-lg"
          />
        </ReactFlow>
      </div>
    </div>

    {/* Preview Modal */}
    <Dialog open={!!previewNode} onOpenChange={() => setPreviewNode(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>👁️ Preview - Visualização do Cliente</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          {previewNode && (
            <PlaybookStepViewer
              label={previewNode.data.label}
              video_url={previewNode.data.video_url}
              rich_content={previewNode.data.rich_content}
              attachments={previewNode.data.attachments}
              quiz_enabled={previewNode.data.quiz_enabled}
              quiz_question={previewNode.data.quiz_question}
              quiz_options={previewNode.data.quiz_options}
              quiz_correct_option={previewNode.data.quiz_correct_option}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Simulator Modal */}
    {simulatorOpen && (
      <PlaybookSimulator
        nodes={nodes}
        edges={edges}
        playbook_name="Playbook de Teste"
        emailTemplates={emailTemplates}
        onClose={() => setSimulatorOpen(false)}
      />
    )}
    </>
  );
}

export default function PlaybookEditor(props: PlaybookEditorProps) {
  return (
    <ReactFlowProvider>
      <PlaybookEditorInner {...props} />
    </ReactFlowProvider>
  );
}
