import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchTickets } from "@/hooks/useSearchTickets";
import { useMergeTicket } from "@/hooks/useMergeTicket";
import { Search, AlertTriangle, GitMerge, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MergeTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTicketId: string;
  sourceTicketSubject: string;
}

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Análise",
  waiting_customer: "Aguardando Cliente",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export function MergeTicketDialog({
  open,
  onOpenChange,
  sourceTicketId,
  sourceTicketSubject,
}: MergeTicketDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [transferComments, setTransferComments] = useState(false);
  
  const { data: searchResults = [], isLoading } = useSearchTickets(searchTerm, sourceTicketId);
  const mergeTicket = useMergeTicket();

  const selectedTicket = searchResults.find(t => t.id === selectedTicketId);

  const handleMerge = () => {
    if (!selectedTicketId) return;

    mergeTicket.mutate({
      sourceTicketId,
      destinationTicketId: selectedTicketId,
      transferComments,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Mesclar Tickets
          </DialogTitle>
          <DialogDescription>
            Selecione o ticket principal onde "{sourceTicketSubject}" será mesclado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alert de Ação Irreversível */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> Esta ação é irreversível. O ticket atual será fechado e vinculado ao ticket selecionado.
            </AlertDescription>
          </Alert>

          {/* Campo de Busca */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar Ticket</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Digite ID, assunto ou nome do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Resultados da Busca */}
          {searchTerm.length >= 2 && (
            <div className="space-y-2">
              <Label>Resultados ({searchResults.length})</Label>
              <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Buscando tickets...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Nenhum ticket encontrado
                  </div>
                ) : (
                  searchResults.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`w-full p-3 text-left hover:bg-accent transition-colors ${
                        selectedTicketId === ticket.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            {selectedTicketId === ticket.id && (
                              <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                            )}
                            <p className="font-medium text-sm line-clamp-1">
                              {ticket.subject}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Cliente: {ticket.customer?.first_name} {ticket.customer?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(ticket.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-xs">
                            {statusLabels[ticket.status]}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {priorityLabels[ticket.priority]}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Preview do Ticket Selecionado */}
          {selectedTicket && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
              <p className="text-sm font-medium">Ticket Selecionado:</p>
              <div className="space-y-1">
                <p className="text-sm"><strong>Assunto:</strong> {selectedTicket.subject}</p>
                <p className="text-sm"><strong>Cliente:</strong> {selectedTicket.customer?.first_name} {selectedTicket.customer?.last_name}</p>
                {selectedTicket.department && (
                  <p className="text-sm"><strong>Departamento:</strong> {selectedTicket.department.name}</p>
                )}
              </div>
            </div>
          )}

          {/* Opção de Transferir Comentários */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="transfer-comments"
              checked={transferComments}
              onCheckedChange={(checked) => setTransferComments(checked as boolean)}
            />
            <Label
              htmlFor="transfer-comments"
              className="text-sm font-normal cursor-pointer"
            >
              Copiar comentários para o ticket principal (como notas internas)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedTicketId || mergeTicket.isPending}
          >
            <GitMerge className="w-4 h-4 mr-2" />
            {mergeTicket.isPending ? "Mesclando..." : "Confirmar Mesclagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}