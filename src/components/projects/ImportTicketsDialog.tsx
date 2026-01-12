import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, FileInput } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMoveTicketsToCards } from "@/hooks/useMoveTicketsToCards";
import type { ProjectColumn } from "@/hooks/useProjectColumns";

interface ImportTicketsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  columns: ProjectColumn[];
}

export function ImportTicketsDialog({
  open,
  onOpenChange,
  boardId,
  columns,
}: ImportTicketsDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const moveTickets = useMoveTicketsToCards();

  // Fetch users (profiles) for selection
  const { data: users = [] } = useQuery({
    queryKey: ["profiles-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch tickets for selected user
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["tickets-for-import", selectedUserId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select("id, subject, description, priority, customer_id, assigned_to, attachments")
        .eq("assigned_to", selectedUserId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "open" | "in_progress" | "waiting_customer" | "resolved" | "closed");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedUserId,
  });

  // Set default column to "Boas Vindas" if exists
  useMemo(() => {
    if (!selectedColumnId && columns.length > 0) {
      const boasVindas = columns.find(
        (c) => c.name.toLowerCase().includes("boas vindas") || c.name.toLowerCase().includes("boas-vindas")
      );
      setSelectedColumnId(boasVindas?.id || columns[0]?.id || "");
    }
  }, [columns, selectedColumnId]);

  const handleImport = () => {
    if (!confirmDelete || !selectedColumnId || tickets.length === 0) return;

    // Map tickets to expected format
    const ticketsToMove = tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      priority: t.priority,
      customer_id: t.customer_id,
      assigned_to: t.assigned_to,
      attachments: t.attachments,
    }));

    moveTickets.mutate(
      {
        tickets: ticketsToMove,
        boardId,
        columnId: selectedColumnId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          // Reset state
          setSelectedUserId("");
          setConfirmDelete(false);
          setStatusFilter("all");
        },
      }
    );
  };

  const canImport = selectedUserId && selectedColumnId && tickets.length > 0 && confirmDelete;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileInput className="h-5 w-5" />
            Importar Tickets como Cards
          </DialogTitle>
          <DialogDescription>
            Mova tickets de um usuário para este projeto. Os tickets serão convertidos em cards e removidos da lista de tickets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label>Selecionar Usuário</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um usuário..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Filtrar por Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="waiting_customer">Aguardando Cliente</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Column Selection */}
          <div className="space-y-2">
            <Label>Coluna de Destino</Label>
            <Select value={selectedColumnId} onValueChange={setSelectedColumnId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma coluna..." />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: column.color || "#666" }}
                      />
                      {column.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {selectedUserId && (
            <div className="space-y-2">
              <Label>
                Tickets a serem movidos:{" "}
                <Badge variant="secondary">{tickets.length}</Badge>
              </Label>
              {ticketsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length > 0 ? (
                <ScrollArea className="h-40 rounded-md border p-2">
                  <ul className="space-y-1">
                    {tickets.map((ticket) => (
                      <li
                        key={ticket.id}
                        className="text-sm text-muted-foreground truncate"
                      >
                        • {ticket.subject}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum ticket encontrado para este usuário.
                </p>
              )}
            </div>
          )}

          {/* Confirmation */}
          {tickets.length > 0 && (
            <div className="flex items-start space-x-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <Checkbox
                id="confirm-delete"
                checked={confirmDelete}
                onCheckedChange={(checked) => setConfirmDelete(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="confirm-delete"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                >
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Confirmar exclusão permanente
                </label>
                <p className="text-xs text-muted-foreground">
                  {tickets.length} tickets serão movidos e removidos permanentemente da lista de tickets.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!canImport || moveTickets.isPending}
          >
            {moveTickets.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Movendo...
              </>
            ) : (
              `Mover ${tickets.length} Tickets`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
