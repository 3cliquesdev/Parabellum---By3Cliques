import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, Plus, Settings2, Users, Filter, FileInput, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useProjectBoard, useUpdateProjectBoard } from "@/hooks/useProjectBoards";
import { useProjectColumns, useReorderProjectColumns } from "@/hooks/useProjectColumns";
import { useProjectCards, useMoveProjectCard, ProjectCard } from "@/hooks/useProjectCards";
import { useProjectRealtime } from "@/hooks/useProjectRealtime";
import { KanbanColumn } from "@/components/projects/KanbanColumn";
import { KanbanCard } from "@/components/projects/KanbanCard";
import { CreateColumnDialog } from "@/components/projects/CreateColumnDialog";
import { CardModal } from "@/components/projects/CardModal";
import { ProjectMembersDialog } from "@/components/projects/ProjectMembersDialog";
import { BoardSettingsDialog } from "@/components/projects/BoardSettingsDialog";
import { ImportTicketsDialog } from "@/components/projects/ImportTicketsDialog";
import { Badge } from "@/components/ui/badge";

export default function ProjectBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  
  const [activeCard, setActiveCard] = useState<ProjectCard | null>(null);
  const [createColumnOpen, setCreateColumnOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [importTicketsOpen, setImportTicketsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: board, isLoading: boardLoading } = useProjectBoard(boardId);
  const { data: columns = [], isLoading: columnsLoading } = useProjectColumns(boardId);
  const { data: cards = [], isLoading: cardsLoading } = useProjectCards(boardId);

  // Mutations
  const moveCard = useMoveProjectCard();
  const reorderColumns = useReorderProjectColumns();
  const updateBoard = useUpdateProjectBoard();

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Realtime
  useProjectRealtime(boardId);

  // Group cards by column
  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, ProjectCard[]> = {};
    columns.forEach((col) => {
      grouped[col.id] = cards
        .filter((card) => card.column_id === col.id)
        .sort((a, b) => a.position - b.position);
    });
    return grouped;
  }, [columns, cards]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find((c) => c.id === active.id);
    if (card) {
      setActiveCard(card);
    }
  }, [cards]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Handle drag over for visual feedback if needed
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || !boardId) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    // Find the card being dragged
    const draggedCard = cards.find((c) => c.id === activeCardId);
    if (!draggedCard) return;

    // Determine target column
    let targetColumnId: string;
    let targetPosition: number;

    // Check if dropped on a column
    const isColumn = columns.some((col) => col.id === overId);
    if (isColumn) {
      targetColumnId = overId;
      // Place at end of column
      const cardsInColumn = cardsByColumn[targetColumnId] || [];
      targetPosition = cardsInColumn.length;
    } else {
      // Dropped on another card
      const targetCard = cards.find((c) => c.id === overId);
      if (!targetCard) return;
      targetColumnId = targetCard.column_id;
      targetPosition = targetCard.position;
    }

    // Only move if something changed
    if (draggedCard.column_id === targetColumnId && draggedCard.position === targetPosition) {
      return;
    }

    moveCard.mutate({
      cardId: activeCardId,
      boardId,
      newColumnId: targetColumnId,
      newPosition: targetPosition,
      oldColumnId: draggedCard.column_id,
    });
  }, [cards, columns, cardsByColumn, boardId, moveCard]);

  const isLoading = boardLoading || columnsLoading || cardsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="flex gap-4 overflow-x-auto">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[600px] w-80 flex-shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Projeto não encontrado</h2>
          <Button variant="outline" onClick={() => navigate("/projects")}>
            Voltar para Projetos
          </Button>
        </div>
      </div>
    );
  }

  const totalCards = cards.length;
  const completedCards = cards.filter((c) => c.is_completed).length;

  const handleStartEditingName = () => {
    setEditedName(board.name);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== board.name) {
      updateBoard.mutate({
        id: board.id,
        name: editedName.trim(),
      });
    }
    setIsEditingName(false);
  };

  const handleCancelEditingName = () => {
    setIsEditingName(false);
    setEditedName(board.name);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/projects")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={nameInputRef}
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") handleCancelEditingName();
                    }}
                    className="text-xl font-bold h-auto py-1 px-2 w-64"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSaveName}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCancelEditingName}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <h1
                  className="text-xl font-bold text-foreground cursor-pointer hover:bg-muted px-2 py-1 rounded inline-flex items-center gap-2 group"
                  onClick={handleStartEditingName}
                >
                  {board.name}
                  <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </h1>
              )}
              {board.description && (
                <p className="text-sm text-muted-foreground">{board.description}</p>
              )}
            </div>
            <Badge variant="secondary">
              {completedCards}/{totalCards} concluídos
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportTicketsOpen(true)}>
              <FileInput className="h-4 w-4 mr-2" />
              Importar Tickets
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMembersDialogOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              Membros
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] || []}
                  boardId={boardId!}
                  onCardClick={setSelectedCardId}
                />
              ))}
            </SortableContext>

            {/* Add Column Button */}
            <div className="flex-shrink-0 w-80">
              <Button
                variant="outline"
                className="w-full h-12 border-dashed"
                onClick={() => setCreateColumnOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Coluna
              </Button>
            </div>
          </div>

          <DragOverlay>
            {activeCard ? (
              <KanbanCard card={activeCard} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Dialogs */}
      <CreateColumnDialog
        open={createColumnOpen}
        onOpenChange={setCreateColumnOpen}
        boardId={boardId!}
      />

      <CardModal
        cardId={selectedCardId}
        boardId={boardId!}
        open={!!selectedCardId}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
      />

      <ProjectMembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        boardId={boardId!}
      />

      {board && (
        <BoardSettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          board={board}
        />
      )}

      <ImportTicketsDialog
        open={importTicketsOpen}
        onOpenChange={setImportTicketsOpen}
        boardId={boardId!}
        columns={columns}
      />
    </div>
  );
}
