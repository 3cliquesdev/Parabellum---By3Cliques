import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTicketById } from "@/hooks/useTicketById";
import { TicketDetails } from "@/components/TicketDetails";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTicketsPresence } from "@/hooks/useTicketsPresence";

export default function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { data: ticket, isLoading, error } = useTicketById(ticketId);
  const { setViewingTicket } = useTicketsPresence();

  // Publicar presença global quando entrar no ticket
  useEffect(() => {
    if (ticketId) {
      setViewingTicket(ticketId);
    }
    
    return () => {
      setViewingTicket(null);
    };
  }, [ticketId, setViewingTicket]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (error || !ticket) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground">Ticket não encontrado</p>
          <Button variant="outline" onClick={() => navigate('/support')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Tickets
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header com botão voltar */}
      <div className="flex-none border-b border-border px-4 py-3 bg-card flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/support')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-lg font-semibold text-foreground truncate">
          Ticket #{ticket.ticket_number || ticket.id.slice(0, 8)}
        </h1>
      </div>

      {/* Detalhes em tela cheia */}
      <div className="flex-1 overflow-hidden">
        <TicketDetails ticket={ticket} />
      </div>
    </PageContainer>
  );
}
