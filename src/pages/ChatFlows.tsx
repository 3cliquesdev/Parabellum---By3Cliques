import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Workflow, MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight, MessageSquare, Copy, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useChatFlows, 
  useCreateChatFlow, 
  useDeleteChatFlow, 
  useToggleChatFlowActive,
  useDuplicateChatFlow,
  ChatFlow 
} from "@/hooks/useChatFlows";
import { useSetMasterFlow } from "@/hooks/useSetMasterFlow";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ChatFlows() {
  const navigate = useNavigate();
  const { data: flows, isLoading } = useChatFlows();
  const createFlow = useCreateChatFlow();
  const deleteFlow = useDeleteChatFlow();
  const toggleActive = useToggleChatFlowActive();
  const duplicateFlow = useDuplicateChatFlow();
  const setMasterFlow = useSetMasterFlow();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<ChatFlow | null>(null);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [newFlowKeywords, setNewFlowKeywords] = useState("");

  const handleCreateFlow = () => {
    if (!newFlowName.trim()) return;
    
    createFlow.mutate({
      name: newFlowName,
      description: newFlowDescription || undefined,
      trigger_keywords: newFlowKeywords.split(",").map(k => k.trim()).filter(Boolean),
      flow_definition: { nodes: [], edges: [] },
      is_active: false,
    }, {
      onSuccess: (data) => {
        setShowNewDialog(false);
        setNewFlowName("");
        setNewFlowDescription("");
        setNewFlowKeywords("");
        // Navegar para editor após criar
        navigate(`/settings/chat-flows/${(data as ChatFlow).id}/edit`);
      }
    });
  };

  const handleEditFlow = (flow: ChatFlow) => {
    navigate(`/settings/chat-flows/${flow.id}/edit`);
  };

  const handleDeleteFlow = () => {
    if (!selectedFlow) return;
    deleteFlow.mutate(selectedFlow.id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        setSelectedFlow(null);
      }
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Workflow className="h-8 w-8 text-primary" />
            Fluxos de Chat
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie fluxos interativos para coleta de dados e atendimento automatizado
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fluxo
        </Button>
      </div>

      {/* Lista de fluxos */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : flows && flows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Card key={flow.id} className={`group hover:shadow-lg transition-shadow cursor-pointer ${flow.is_master_flow ? 'ring-2 ring-yellow-500/50 bg-yellow-500/5' : ''}`} onClick={() => handleEditFlow(flow)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {flow.is_master_flow ? (
                        <Crown className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-primary" />
                      )}
                      {flow.name}
                      {flow.is_master_flow && (
                        <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-xs">
                          MESTRE
                        </Badge>
                      )}
                    </CardTitle>
                    {flow.description && (
                      <CardDescription className="line-clamp-2">
                        {flow.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditFlow(flow); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateFlow.mutate(flow); }}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: flow.id, is_active: !flow.is_active }); }}
                      >
                        {flow.is_active ? (
                          <>
                            <ToggleLeft className="h-4 w-4 mr-2" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <ToggleRight className="h-4 w-4 mr-2" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); setMasterFlow.mutate({ flowId: flow.id, setAsMaster: !flow.is_master_flow }); }}
                        className={flow.is_master_flow ? "text-yellow-600" : ""}
                      >
                        <Crown className={`h-4 w-4 mr-2 ${flow.is_master_flow ? 'text-yellow-500' : ''}`} />
                        {flow.is_master_flow ? 'Remover como Mestre' : 'Definir como Mestre'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => {
                           e.stopPropagation();
                           setSelectedFlow(flow);
                           setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={flow.is_active ? "default" : "secondary"}>
                      {flow.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge variant="outline">
                      {(flow.flow_definition as any)?.nodes?.length || 0} blocos
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(flow.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                {flow.trigger_keywords && flow.trigger_keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {flow.trigger_keywords.slice(0, 3).map((kw, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                    {flow.trigger_keywords.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{flow.trigger_keywords.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum fluxo criado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro fluxo de chat para automatizar a coleta de dados
            </p>
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Fluxo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog para novo fluxo */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fluxo de Chat</DialogTitle>
            <DialogDescription>
              Configure as informações básicas do fluxo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do fluxo *</Label>
              <Input
                id="name"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                placeholder="Ex: Coleta de dados comercial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={newFlowDescription}
                onChange={(e) => setNewFlowDescription(e.target.value)}
                placeholder="Descreva o objetivo do fluxo..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">Palavras-chave (separadas por vírgula)</Label>
              <Input
                id="keywords"
                value={newFlowKeywords}
                onChange={(e) => setNewFlowKeywords(e.target.value)}
                placeholder="comprar, preço, plano"
              />
              <p className="text-xs text-muted-foreground">
                O fluxo será ativado quando o cliente enviar mensagens contendo essas palavras
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFlow} disabled={!newFlowName.trim() || createFlow.isPending}>
              {createFlow.isPending ? "Criando..." : "Criar e Editar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o fluxo "{selectedFlow?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFlow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFlow.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
