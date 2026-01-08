import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Users, CheckCircle2, MoreVertical, Archive, Trash2, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectBoard, useUpdateProjectBoard, useDeleteProjectBoard } from "@/hooks/useProjectBoards";
import { cn } from "@/lib/utils";
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
import { useState } from "react";

interface ProjectBoardCardProps {
  board: ProjectBoard;
  viewMode: "grid" | "list";
  onClick: () => void;
}

export function ProjectBoardCard({ board, viewMode, onClick }: ProjectBoardCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const updateBoard = useUpdateProjectBoard();
  const deleteBoard = useDeleteProjectBoard();

  const statusColors = {
    active: "bg-green-500/10 text-green-600 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    archived: "bg-muted text-muted-foreground",
  };

  const statusLabels = {
    active: "Ativo",
    completed: "Concluído",
    archived: "Arquivado",
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateBoard.mutate({
      id: board.id,
      status: board.status === "archived" ? "active" : "archived",
    });
  };

  const handleDelete = () => {
    deleteBoard.mutate(board.id);
    setDeleteDialogOpen(false);
  };

  const clientName = board.contact
    ? `${board.contact.first_name} ${board.contact.last_name}`
    : board.organization?.name || "—";

  if (viewMode === "list") {
    return (
      <>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={onClick}
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground truncate">
                  {board.name}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate">{clientName}</span>
                </div>
              </div>
              <Badge variant="outline" className={cn("shrink-0", statusColors[board.status])}>
                {statusLabels[board.status]}
              </Badge>
              {board.due_date && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(board.due_date), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  {board.status === "archived" ? "Desarquivar" : "Arquivar"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os dados do projeto serão perdidos.
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
      </>
    );
  }

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-lg transition-all group"
        onClick={onClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {board.name}
              </h3>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{clientName}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  {board.status === "archived" ? "Desarquivar" : "Arquivar"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {board.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {board.description}
            </p>
          )}
          
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn(statusColors[board.status])}>
              {statusLabels[board.status]}
            </Badge>
            {board.due_date && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(board.due_date), "dd/MM", { locale: ptBR })}
              </div>
            )}
          </div>

          {/* Progress indicator - will be calculated from cards */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>0 / 0 tarefas</span>
            </div>
            <span className="text-muted-foreground/50">•</span>
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>0 membros</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados do projeto serão perdidos.
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
    </>
  );
}
