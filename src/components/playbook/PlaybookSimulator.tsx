import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { X, User, Play } from "lucide-react";
import { Node, Edge } from "reactflow";
import ReactFlow, { Background, BackgroundVariant, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import { SimulatorStepRenderer } from "./SimulatorStepRenderer";
import confetti from "canvas-confetti";
import { nodeTypes } from "./PlaybookEditor";

interface PlaybookSimulatorProps {
  nodes: Node[];
  edges: Edge[];
  playbook_name: string;
  emailTemplates?: any[];
  onClose: () => void;
}

interface MockCustomer {
  name: string;
  email: string;
}

export function PlaybookSimulator({
  nodes,
  edges,
  playbook_name,
  emailTemplates,
  onClose,
}: PlaybookSimulatorProps) {
  const mockCustomer: MockCustomer = {
    name: "Cliente Teste",
    email: "teste@exemplo.com",
  };

  // Find initial node (no incoming edges)
  const initialNodeId = useMemo(() => {
    const nodeIdsWithIncoming = new Set(edges.map((e) => e.target));
    const startNode = nodes.find((n) => !nodeIdsWithIncoming.has(n.id));
    return startNode?.id || nodes[0]?.id || null;
  }, [nodes, edges]);

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(initialNodeId);
  const [completedNodeIds, setCompletedNodeIds] = useState<string[]>([]);

  const currentNode = nodes.find((n) => n.id === currentNodeId);

  // Get next node based on current
  const getNextNode = useCallback(
    (nodeId: string, path?: "true" | "false") => {
      const outgoingEdge = edges.find((e) => {
        if (e.source !== nodeId) return false;
        if (path && e.sourceHandle !== path) return false;
        return true;
      });
      return outgoingEdge ? nodes.find((n) => n.id === outgoingEdge.target) : null;
    },
    [edges, nodes]
  );

  // Mark step as completed and advance
  const completeStep = useCallback(
    (path?: "true" | "false") => {
      if (!currentNodeId) return;

      setCompletedNodeIds((prev) => [...prev, currentNodeId]);
      const nextNode = getNextNode(currentNodeId, path);

      if (nextNode) {
        setCurrentNodeId(nextNode.id);
      } else {
        // End of flow - celebration!
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ["#2563EB", "#3B82F6", "#60A5FA", "#10B981"],
        });
        setTimeout(() => {
          alert("🎉 Simulação Completa! Todos os passos foram executados.");
          onClose();
        }, 500);
      }
    },
    [currentNodeId, getNextNode, onClose]
  );

  // Highlighted nodes for mini diagram
  const highlightedNodes = useMemo(() => {
    return nodes.map((node) => {
      const isCompleted = completedNodeIds.includes(node.id);
      const isCurrent = node.id === currentNodeId;
      
      return {
        ...node,
        data: {
          ...node.data,
          label: isCompleted ? `✅ ${node.data.label}` : isCurrent ? `🔵 ${node.data.label}` : node.data.label,
        },
        className: isCompleted
          ? "!ring-2 !ring-green-500 !opacity-100"
          : isCurrent
          ? "!ring-2 !ring-blue-500 !opacity-100 !animate-pulse"
          : "!opacity-50",
      };
    });
  }, [nodes, completedNodeIds, currentNodeId]);

  const progressPercentage = (completedNodeIds.length / nodes.length) * 100;

  if (!currentNode) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <Play className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              ▶️ Simulador de Jornada - "{playbook_name}"
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Split View */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Mini Diagram (30%) */}
          <div className="w-[30%] border-r bg-muted/10 overflow-hidden">
            <div className="h-full">
              <ReactFlow
                nodes={highlightedNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
              >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <MiniMap
                  nodeColor={(node) => {
                    if (completedNodeIds.includes(node.id)) return "#10b981";
                    if (node.id === currentNodeId) return "#2563EB";
                    return "#9ca3af";
                  }}
                  className="!bg-card !border !shadow-sm !rounded-md"
                  maskColor="rgba(0, 0, 0, 0.1)"
                />
              </ReactFlow>
            </div>
          </div>

          {/* Right: Step Content (70%) */}
          <div className="flex-1 overflow-auto bg-background">
            <div className="p-8 max-w-4xl mx-auto">
              <SimulatorStepRenderer
                node={currentNode}
                emailTemplates={emailTemplates}
                mockCustomer={mockCustomer}
                onComplete={completeStep}
              />
            </div>
          </div>
        </div>

        {/* Bottom Progress Bar */}
        <div className="border-t bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{mockCustomer.name}</span>
              <span className="text-xs text-muted-foreground">({mockCustomer.email})</span>
            </div>

            <div className="flex-1">
              <Progress value={progressPercentage} className="h-2" />
            </div>

            <Badge variant="secondary">
              {completedNodeIds.length}/{nodes.length} passos
            </Badge>

            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
              🧪 Modo Sandbox
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
