import { useCallback, useState } from "react";
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
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Clock, CheckSquare, Phone, Save, X } from "lucide-react";
import { EmailNode } from "./EmailNode";
import { DelayNode } from "./DelayNode";
import { TaskNode } from "./TaskNode";
import { CallNode } from "./CallNode";

const nodeTypes = {
  email: EmailNode,
  delay: DelayNode,
  task: TaskNode,
  call: CallNode,
};

interface PlaybookEditorProps {
  initialFlow?: { nodes: Node[]; edges: Edge[] };
  onSave: (flow: { nodes: Node[]; edges: Edge[] }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function PlaybookEditor({ initialFlow, onSave, onCancel, isSaving }: PlaybookEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow?.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: {
        label: `Novo ${type}`,
        ...(type === "email" && { subject: "Assunto do email" }),
        ...(type === "delay" && { duration_days: 1 }),
        ...(type === "task" && { task_type: "task", description: "Descrição da tarefa" }),
        ...(type === "call" && { description: "Descrição da ligação" }),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNodeData = (field: string, value: any) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, [field]: value } }
          : node
      )
    );
  };

  const handleSave = () => {
    onSave({ nodes, edges });
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="flex h-[600px] gap-4">
      {/* Sidebar de blocos */}
      <Card className="w-64 p-4 space-y-2">
        <h3 className="font-semibold mb-3">Blocos Disponíveis</h3>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => addNode("email")}
        >
          <Mail className="h-4 w-4" />
          Email
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => addNode("delay")}
        >
          <Clock className="h-4 w-4" />
          Esperar
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => addNode("task")}
        >
          <CheckSquare className="h-4 w-4" />
          Tarefa
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => addNode("call")}
        >
          <Phone className="h-4 w-4" />
          Ligação
        </Button>

        {/* Painel de propriedades */}
        {selectedNode && (
          <div className="mt-6 pt-6 border-t space-y-3">
            <h4 className="font-semibold">Propriedades</h4>
            <div>
              <Label>Nome</Label>
              <Input
                value={selectedNode.data.label}
                onChange={(e) => updateNodeData("label", e.target.value)}
              />
            </div>
            {selectedNode.type === "email" && (
              <div>
                <Label>Assunto</Label>
                <Input
                  value={selectedNode.data.subject || ""}
                  onChange={(e) => updateNodeData("subject", e.target.value)}
                />
              </div>
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
            {(selectedNode.type === "task" || selectedNode.type === "call") && (
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={selectedNode.data.description || ""}
                  onChange={(e) => updateNodeData("description", e.target.value)}
                />
              </div>
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
      <div className="flex-1 border rounded-lg">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
