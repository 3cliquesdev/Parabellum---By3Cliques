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
import { Mail, Clock, CheckSquare, Phone, Save, X, GitBranch, UserCheck, Eye, HelpCircle, Plus, Trash2, Play } from "lucide-react";
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
import { DraggableBlock } from "./DraggableBlock";
import { RichTextEditor } from "./RichTextEditor";
import { VideoEmbedField } from "./VideoEmbedField";
import { AttachmentsUploader } from "./AttachmentsUploader";
import { PlaybookStepViewer } from "./PlaybookStepViewer";
import { PlaybookSimulator } from "./PlaybookSimulator";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";

export const nodeTypes = {
  email: EmailNode,
  delay: DelayNode,
  task: TaskNode,
  call: CallNode,
  condition: ConditionNode,
  approval: ApprovalNode,
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
          attachments: []
        }),
        ...(type === "call" && { description: "Descrição da ligação" }),
        ...(type === "condition" && { condition_type: "email_opened", condition_value: "" }),
        ...(type === "approval" && { approver_role: "consultant", approval_message: "Revisar antes de continuar" }),
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
                    onValueChange={(value) => updateNodeData("condition_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email_opened">Email Aberto</SelectItem>
                      <SelectItem value="email_clicked">Email Clicado</SelectItem>
                      <SelectItem value="meeting_booked">Reunião Agendada</SelectItem>
                      <SelectItem value="tag_exists">Tag Existe</SelectItem>
                      <SelectItem value="status_change">Mudança de Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor da Condição</Label>
                  <Input
                    value={selectedNode.data.condition_value || ""}
                    onChange={(e) => updateNodeData("condition_value", e.target.value)}
                    placeholder="Ex: nome do email, tag, etc"
                  />
                </div>
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
