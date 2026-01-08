import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar as CalendarIcon,
  Clock,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Users,
  Tag,
  Trash2,
  Plus,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectCard, useUpdateProjectCard, useDeleteProjectCard } from "@/hooks/useProjectCards";
import { useProjectChecklists, useCreateProjectChecklist, useCreateChecklistItem, useUpdateChecklistItem } from "@/hooks/useProjectChecklists";
import { useProjectComments, useCreateProjectComment } from "@/hooks/useProjectComments";
import { useToast } from "@/hooks/use-toast";
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

interface CardModalProps {
  cardId: string | null;
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function CardModal({ cardId, boardId, open, onOpenChange }: CardModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newChecklistName, setNewChecklistName] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [addingItemToChecklist, setAddingItemToChecklist] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");

  const { data: card, isLoading } = useProjectCard(cardId || undefined);
  const { data: checklists = [] } = useProjectChecklists(cardId || undefined);
  const { data: comments = [] } = useProjectComments(cardId || undefined);

  const updateCard = useUpdateProjectCard();
  const deleteCard = useDeleteProjectCard();
  const createChecklist = useCreateProjectChecklist();
  const createChecklistItem = useCreateChecklistItem();
  const updateChecklistItem = useUpdateChecklistItem();
  const createComment = useCreateProjectComment();

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || "");
    }
  }, [card]);

  const handleSaveTitle = () => {
    if (card && title.trim() && title !== card.title) {
      updateCard.mutate({ id: card.id, board_id: boardId, title: title.trim() });
    }
  };

  const handleSaveDescription = () => {
    if (card && description !== card.description) {
      updateCard.mutate({ id: card.id, board_id: boardId, description: description || null });
    }
  };

  const handlePriorityChange = (priority: string) => {
    if (card) {
      updateCard.mutate({
        id: card.id,
        board_id: boardId,
        priority: priority as "low" | "medium" | "high" | "urgent",
      });
    }
  };

  const handleDueDateChange = (date: Date | undefined) => {
    if (card) {
      updateCard.mutate({
        id: card.id,
        board_id: boardId,
        due_date: date ? date.toISOString() : null,
      });
    }
  };

  const handleToggleCompleted = () => {
    if (card) {
      updateCard.mutate({
        id: card.id,
        board_id: boardId,
        is_completed: !card.is_completed,
      });
    }
  };

  const { toast } = useToast();

  const handleDelete = () => {
    if (card) {
      deleteCard.mutate(
        { id: card.id, board_id: boardId },
        {
          onSuccess: () => {
            toast({ title: "Card excluído com sucesso!" });
            setDeleteDialogOpen(false);
            onOpenChange(false);
          },
          onError: (error) => {
            toast({ variant: "destructive", title: "Erro ao excluir card", description: error.message });
          },
        }
      );
    }
  };

  const handleAddChecklist = () => {
    if (newChecklistName.trim() && cardId) {
      createChecklist.mutate({
        card_id: cardId,
        title: newChecklistName.trim(),
      });
      setNewChecklistName("");
      setAddingChecklist(false);
    }
  };

  const handleAddChecklistItem = (checklistId: string) => {
    if (newItemTitle.trim() && cardId) {
      createChecklistItem.mutate({
        checklist_id: checklistId,
        card_id: cardId,
        title: newItemTitle.trim(),
      });
      setNewItemTitle("");
      setAddingItemToChecklist(null);
    }
  };

  const handleSendComment = () => {
    if (newComment.trim() && cardId) {
      createComment.mutate({
        card_id: cardId,
        board_id: boardId,
        content: newComment.trim(),
      });
      setNewComment("");
    }
  };

  if (!open) return null;

  return (
    <>
      {/* AlertDialog MUST be outside the main Dialog to avoid portal conflicts */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir card?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O card e todos os seus dados serão removidos permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCard.isPending}
            >
              {deleteCard.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : card ? (
            <>
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={card.is_completed}
                    onCheckedChange={handleToggleCompleted}
                  />
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                  />
                </div>
              </DialogHeader>

              <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="flex-shrink-0">
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="checklists" className="gap-1.5">
                    <CheckSquare className="h-4 w-4" />
                    Checklists
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Comentários
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-4">
                  <TabsContent value="details" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <Select value={card.priority} onValueChange={handlePriorityChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Data de Entrega</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start", !card.due_date && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {card.due_date ? format(new Date(card.due_date), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={card.due_date ? new Date(card.due_date) : undefined} onSelect={handleDueDateChange} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea placeholder="Adicione uma descrição..." value={description} onChange={(e) => setDescription(e.target.value)} onBlur={handleSaveDescription} rows={4} />
                    </div>
                    <div className="pt-4 border-t">
                      <Button 
                        variant="destructive" 
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />Excluir Card
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="checklists" className="space-y-4 mt-0">
                    {checklists.map((checklist) => (
                      <div key={checklist.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3">{checklist.title}</h4>
                        <div className="space-y-2">
                          {checklist.items?.map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={item.is_completed}
                                onCheckedChange={() => updateChecklistItem.mutate({ id: item.id, card_id: cardId!, is_completed: !item.is_completed })}
                              />
                              <span className={cn("text-sm", item.is_completed && "line-through text-muted-foreground")}>{item.title}</span>
                            </div>
                          ))}
                        </div>
                        {addingItemToChecklist === checklist.id ? (
                          <div className="mt-3 flex gap-2">
                            <Input placeholder="Novo item..." value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddChecklistItem(checklist.id); if (e.key === "Escape") setAddingItemToChecklist(null); }} autoFocus />
                            <Button size="sm" onClick={() => handleAddChecklistItem(checklist.id)}>Adicionar</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAddingItemToChecklist(checklist.id)}><Plus className="h-4 w-4 mr-1" />Adicionar item</Button>
                        )}
                      </div>
                    ))}
                    {addingChecklist ? (
                      <div className="flex gap-2">
                        <Input placeholder="Nome da checklist..." value={newChecklistName} onChange={(e) => setNewChecklistName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddChecklist(); if (e.key === "Escape") setAddingChecklist(false); }} autoFocus />
                        <Button onClick={handleAddChecklist}>Criar</Button>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={() => setAddingChecklist(true)}><Plus className="h-4 w-4 mr-2" />Nova Checklist</Button>
                    )}
                  </TabsContent>

                  <TabsContent value="comments" className="space-y-4 mt-0">
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.profile?.avatar_url || undefined} />
                            <AvatarFallback>{comment.profile?.full_name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{comment.profile?.full_name}</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                            </div>
                            <p className="text-sm mt-1">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-4 border-t">
                      <Textarea placeholder="Escreva um comentário..." value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} className="flex-1" />
                      <Button size="icon" onClick={handleSendComment} disabled={!newComment.trim()}><Send className="h-4 w-4" /></Button>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          ) : <div className="text-center py-8 text-muted-foreground">Card não encontrado</div>}
        </DialogContent>
      </Dialog>
    </>
  );
}
