import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatFlowEditor } from "@/components/chat-flows/ChatFlowEditor";
import { ChatFlowSimulator } from "@/components/chat-flows/ChatFlowSimulator";
import { useChatFlow, useUpdateChatFlow } from "@/hooks/useChatFlows";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Node, Edge } from "reactflow";

export default function ChatFlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: flow, isLoading } = useChatFlow(id || null);
  const updateFlow = useUpdateChatFlow();
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [currentFlowState, setCurrentFlowState] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  const handleSave = (flowDef: { nodes: Node[]; edges: Edge[] }) => {
    if (!id) return;
    
    updateFlow.mutate({
      id,
      flow_definition: flowDef,
    }, {
      onSuccess: () => {
        navigate("/settings/chat-flows");
      }
    });
  };

  const handleCancel = () => {
    navigate("/settings/chat-flows");
  };

  const handleFlowChange = (flowDef: { nodes: Node[]; edges: Edge[] }) => {
    setCurrentFlowState(flowDef);
  };

  const handleOpenSimulator = () => {
    setSimulatorOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="h-14 border-b flex items-center px-4 gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <p className="text-muted-foreground">Fluxo não encontrado</p>
        <Button variant="link" onClick={() => navigate("/settings/chat-flows")}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  // Usar estado atual ou inicial
  const simulatorNodes = currentFlowState?.nodes || (flow.flow_definition as any)?.nodes || [];
  const simulatorEdges = currentFlowState?.edges || (flow.flow_definition as any)?.edges || [];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header fixo */}
      <div className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 relative z-50">
        <div className="flex items-center gap-3">
          <Button 
            type="button"
            variant="ghost" 
            size="icon" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                navigate("/settings/chat-flows");
              } catch {
                window.location.href = "/settings/chat-flows";
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="hover:bg-muted relative z-[100]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="border-l pl-3">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{flow.name}</h1>
              <Badge variant={flow.is_active ? "default" : "secondary"} className="text-xs">
                {flow.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Editor de Fluxo Visual</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenSimulator}
            disabled={simulatorNodes.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Testar
          </Button>
        </div>
      </div>
      
      {/* Editor fullscreen */}
      <div className="flex-1 overflow-hidden">
        <ChatFlowEditor
          initialFlow={flow.flow_definition as any}
          onSave={handleSave}
          onCancel={handleCancel}
          onFlowChange={handleFlowChange}
          isSaving={updateFlow.isPending}
        />
      </div>

      {/* Simulador */}
      <ChatFlowSimulator
        open={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        nodes={simulatorNodes}
        edges={simulatorEdges}
        flowName={flow.name}
      />
    </div>
  );
}
