import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Loader2, Settings2, Info, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatFlowEditor } from "@/components/chat-flows/ChatFlowEditor";
import { FlowTestDialog } from "@/components/chat-flows/FlowTestDialog";
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
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [currentFlowState, setCurrentFlowState] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [flowName, setFlowName] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [triggersText, setTriggersText] = useState("");

  // Sincronizar estado quando flow carregar
  useEffect(() => {
    if (flow) {
      setFlowName(flow.name);
      setKeywordsText((flow.trigger_keywords || []).join(", "));
      setTriggersText((flow.triggers || []).join("\n"));
    }
  }, [flow]);

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
    // Estado já sincronizado pelo useEffect
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    if (!id) return;

    const trimmedName = flowName.trim();
    if (!trimmedName) {
      return; // Nome é obrigatório
    }

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
        name: trimmedName,
        trigger_keywords,
        triggers,
      },
      {
        onSuccess: () => {
          setSettingsOpen(false);
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
      <div className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0 relative z-[9999]" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative z-[9999]"
            onClick={() => {
              window.location.href = "/settings/chat-flows";
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="border-l pl-3">
            <div className="flex items-center gap-2">
              <button 
                type="button"
                className="font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5 group"
                onClick={handleOpenSettings}
                title="Clique para editar nome e configurações"
              >
                {flow.name}
                <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
              </button>
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
              <Label htmlFor="flowName">Nome do fluxo *</Label>
              <Input
                id="flowName"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="Ex: Promoção Pré-Carnaval"
              />
            </div>

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
