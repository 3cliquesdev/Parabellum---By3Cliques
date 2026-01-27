import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Loader2, Settings2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatFlowEditor } from "@/components/chat-flows/ChatFlowEditor";
import { ChatFlowSimulator } from "@/components/chat-flows/ChatFlowSimulator";
import { useChatFlow, useUpdateChatFlow } from "@/hooks/useChatFlows";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Node, Edge } from "reactflow";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function ChatFlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: flow, isLoading } = useChatFlow(id || null);
  const updateFlow = useUpdateChatFlow();
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [currentFlowState, setCurrentFlowState] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keywordsText, setKeywordsText] = useState("");
  const [triggersText, setTriggersText] = useState("");

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

  const handleOpenSettings = () => {
    const kws = (flow?.trigger_keywords || []).join(", ");
    const trgs = (flow?.triggers || []).join("\n");
    setKeywordsText(kws);
    setTriggersText(trgs);
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    if (!id) return;

    const trigger_keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const triggers = triggersText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    updateFlow.mutate(
      {
        id,
        trigger_keywords,
        triggers,
      },
      {
        onSuccess: () => {
          setSettingsOpen(false);
          // Força atualização dos dados do flow na UI
          queryClient.invalidateQueries({ queryKey: ["chat-flow", id] });
        },
      }
    );
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
          <a
            href="/settings/chat-flows"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate("/settings/chat-flows");
            }}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted relative z-[100]"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
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
        <div className="flex items-center gap-2">
          {/* Badge de gatilhos configurados */}
          {((flow.trigger_keywords?.length || 0) > 0 || (flow.triggers?.length || 0) > 0) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs cursor-help">
                  {flow.trigger_keywords?.length || 0} gatilhos
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">
                  Este fluxo será ativado automaticamente quando o cliente enviar mensagens com essas palavras-chave.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenSimulator}
            disabled={simulatorNodes.length === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Testar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenSettings}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Palavras-chave
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

      {/* Configurações do fluxo (gatilhos) */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gatilhos do fluxo</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Como funciona:</strong> Quando um cliente envia uma mensagem contendo 
                  essas palavras-chave, este fluxo será ativado automaticamente pelo chatbot IA.
                </p>
                <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                  <Info className="h-4 w-4 mt-0.5 text-primary" />
                  <div className="text-xs">
                    <p><strong>Palavras-chave:</strong> Termos curtos (ex: "carnaval", "promoção")</p>
                    <p><strong>Frases exatas:</strong> Mensagens longas para match mais preciso</p>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keywords">Palavras-chave (separadas por vírgula)</Label>
              <Input
                id="keywords"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="promoção, pré carnaval, preço"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="triggers">Frases exatas (uma por linha) (opcional)</Label>
              <Textarea
                id="triggers"
                value={triggersText}
                onChange={(e) => setTriggersText(e.target.value)}
                placeholder="Olá vim pelo email e gostaria..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveSettings} disabled={updateFlow.isPending}>
              {updateFlow.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
