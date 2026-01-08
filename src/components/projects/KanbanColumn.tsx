import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MoreHorizontal, Plus, Trash2, Edit, Mail, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ProjectColumn, useUpdateProjectColumn, useDeleteProjectColumn } from "@/hooks/useProjectColumns";
import { ProjectCard, useCreateProjectCard } from "@/hooks/useProjectCards";
import { KanbanCard } from "./KanbanCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ColumnSettingsDialog } from "./ColumnSettingsDialog";

interface KanbanColumnProps {
  column: ProjectColumn;
  cards: ProjectCard[];
  boardId: string;
  onCardClick: (cardId: string) => void;
}

export function KanbanColumn({ column, cards, boardId, onCardClick }: KanbanColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const updateColumn = useUpdateProjectColumn();
  const deleteColumn = useDeleteProjectColumn();
  const createCard = useCreateProjectCard();

  const handleSaveName = () => {
    if (editName.trim() && editName !== column.name) {
      updateColumn.mutate({
        id: column.id,
        board_id: boardId,
        name: editName.trim(),
      });
    }
    setIsEditing(false);
  };

  const handleAddCard = () => {
    if (newCardTitle.trim()) {
      createCard.mutate({
        board_id: boardId,
        column_id: column.id,
        title: newCardTitle.trim(),
      });
      setNewCardTitle("");
      setIsAddingCard(false);
    }
  };

  const handleDelete = () => {
    deleteColumn.mutate({ id: column.id, board_id: boardId });
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-shrink-0 w-80 bg-muted/50 rounded-lg flex flex-col max-h-[calc(100vh-200px)]",
          isOver && "ring-2 ring-primary ring-offset-2"
        )}
      >
        {/* Column Header */}
        <div
          className="p-3 flex items-center justify-between border-b"
          style={{ borderLeftColor: column.color, borderLeftWidth: 4 }}
        >
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              className="h-7 text-sm font-medium"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{column.name}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {cards.length}
              </span>
              {column.is_final && (
                <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                  Final
                </span>
              )}
              {column.notify_client_on_enter && (
                <Mail className="h-3 w-3 text-blue-500" />
              )}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Cards */}
        <ScrollArea className="flex-1 p-2">
          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {cards.map((card) => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  onClick={() => onCardClick(card.id)}
                />
              ))}
            </div>
          </SortableContext>

          {/* Add Card Form */}
          {isAddingCard ? (
            <div className="mt-2 p-2 bg-card rounded-lg border shadow-sm">
              <Input
                placeholder="Título do card..."
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCard();
                  if (e.key === "Escape") {
                    setIsAddingCard(false);
                    setNewCardTitle("");
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={handleAddCard}>
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingCard(false);
                    setNewCardTitle("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </ScrollArea>

        {/* Add Card Button */}
        {!isAddingCard && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setIsAddingCard(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar card
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os {cards.length} cards desta coluna também serão excluídos.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ColumnSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        column={column}
        boardId={boardId}
      />
    </>
  );
}
