import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle } from "lucide-react";
import { useProjectBoards } from "@/hooks/useProjectBoards";
import { useMoveTicketsToCards } from "@/hooks/useMoveTicketsToCards";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Json } from "@/integrations/supabase/types";

interface BulkMoveToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTicketIds: string[];
  onSuccess: () => void;
}

interface ColumnData {
  id: string;
  name: string;
}

export function BulkMoveToProjectDialog({
  open,
  onOpenChange,
  selectedTicketIds,
  onSuccess,
}: BulkMoveToProjectDialogProps) {
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: boards = [], isLoading: boardsLoading } = useProjectBoards();
  const moveTickets = useMoveTicketsToCards();

  // Fetch columns for selected board
  const { data: columns = [], isLoading: columnsLoading } = useQuery({
    queryKey: ["project-columns", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return [];
      const { data, error } = await supabase
        .from("project_columns")
        .select("id, name")
        .eq("board_id", selectedBoardId)
        .order("position");
      if (error) throw error;
      return data as ColumnData[];
    },
    enabled: !!selectedBoardId,
  });

  // Fetch ticket details
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["tickets-to-move", selectedTicketIds],
    queryFn: async () => {
      if (selectedTicketIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tickets")
        .select("id, subject, description, priority, customer_id, assigned_to, attachments")
        .in("id", selectedTicketIds);
      if (error) throw error;
      return data as Array<{
        id: string;
        subject: string;
        description: string | null;
        priority: string;
        customer_id: string | null;
        assigned_to: string | null;
        attachments: Json | null;
      }>;
    },
    enabled: open && selectedTicketIds.length > 0,
  });

  // Auto-select first column (preferably "Boas Vindas")
  useEffect(() => {
    if (columns.length > 0 && !selectedColumnId) {
      const welcomeColumn = columns.find(
        (c) => c.name.toLowerCase().includes("boas vindas")
      );
      setSelectedColumnId(welcomeColumn?.id || columns[0].id);
    }
  }, [columns, selectedColumnId]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedBoardId("");
      setSelectedColumnId("");
      setConfirmDelete(false);
    }
  }, [open]);

  const handleMove = () => {
    if (!selectedBoardId || !selectedColumnId || !confirmDelete) return;

    moveTickets.mutate(
      {
        tickets,
        boardId: selectedBoardId,
        columnId: selectedColumnId,
      },
      {
        onSuccess: () => {
          onSuccess();
          onOpenChange(false);
        },
      }
    );
  };

  const isLoading = boardsLoading || ticketsLoading;
  const canSubmit =
    selectedBoardId &&
    selectedColumnId &&
    confirmDelete &&
    tickets.length > 0 &&
    !moveTickets.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover Tickets para Projeto</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Projeto de destino</Label>
              <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start"
                  sideOffset={4}
                  className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                >
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBoardId && (
              <div className="space-y-2">
                <Label>Coluna de destino</Label>
                <Select
                  value={selectedColumnId}
                  onValueChange={setSelectedColumnId}
                  disabled={columnsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma coluna" />
                  </SelectTrigger>
                  <SelectContent 
                    position="popper" 
                    side="bottom" 
                    align="start"
                    sideOffset={4}
                    className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                  >
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-sm text-foreground">
                <strong>{tickets.length}</strong> ticket
                {tickets.length > 1 ? "s" : ""} será
                {tickets.length > 1 ? "ão" : ""} movido
                {tickets.length > 1 ? "s" : ""} para o projeto
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  Os tickets serão <strong>permanentemente removidos</strong> da
                  lista de tickets após a conversão para cards.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="confirm-delete"
                    checked={confirmDelete}
                    onCheckedChange={(checked) =>
                      setConfirmDelete(checked === true)
                    }
                  />
                  <label
                    htmlFor="confirm-delete"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Entendo e confirmo a exclusão dos tickets
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleMove} disabled={!canSubmit}>
            {moveTickets.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Mover {tickets.length} ticket{tickets.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
