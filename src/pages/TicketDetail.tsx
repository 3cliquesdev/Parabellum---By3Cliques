import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTicketById } from "@/hooks/useTicketById";
import { TicketDetails } from "@/components/TicketDetails";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useTicketsPresence } from "@/hooks/useTicketsPresence";
import { usePerformanceLog } from "@/lib/prefetch";

export default function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { data: ticket, isLoading, error } = useTicketById(ticketId);
  const { setViewingTicket } = useTicketsPresence();

  usePerformanceLog('TicketDetail', !isLoading);

  // Publicar presença global quando entrar no ticket
  useEffect(() => {
    if (ticketId) {
      setViewingTicket(ticketId);
    }
    
    return () => {
      setViewingTicket(null);
    };
  }, [ticketId, setViewingTicket]);

  // Render-first: header always visible immediately
  return (
    <PageContainer>
      {/* Header renders instantly with ticketId from URL */}
      <div className="flex-none border-b border-border px-4 py-3 bg-card flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/support')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-lg font-semibold text-foreground truncate">
          {ticket
            ? `Ticket #${ticket.ticket_number || ticket.id.slice(0, 8)}`
            : ticketId
              ? `Ticket #${ticketId.slice(0, 8)}...`
              : 'Ticket'
          }
        </h1>
      </div>

      {/* Body: skeleton while loading, error state, or full details */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-3 mt-6">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-7 w-28" />
            </div>
            <Skeleton className="h-[300px] w-full mt-4" />
          </div>
        ) : error || !ticket ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-muted-foreground">Ticket não encontrado</p>
            <Button variant="outline" onClick={() => navigate('/support')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Tickets
            </Button>
          </div>
        ) : (
          <TicketDetails ticket={ticket} />
        )}
      </div>
    </PageContainer>
  );
}
