import { useState } from "react";
import { useTickets } from "@/hooks/useTickets";
import { TicketsList } from "@/components/TicketsList";
import { TicketDetails } from "@/components/TicketDetails";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

type FilterType = 'all' | 'mine' | 'unassigned';

export default function Support() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const { data: tickets = [], isLoading } = useTickets(undefined, filter);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Suporte</h1>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <TabsList>
            <TabsTrigger value="all">Todos os Tickets</TabsTrigger>
            <TabsTrigger value="mine">Meus Tickets</TabsTrigger>
            <TabsTrigger value="unassigned">Não Atribuídos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de Tickets (30%) */}
        <div className="w-[30%] border-r overflow-hidden">
          <TicketsList
            tickets={tickets}
            selectedTicketId={selectedTicketId}
            onSelectTicket={setSelectedTicketId}
          />
        </div>

        {/* Detalhes do Ticket (70%) */}
        <div className="flex-1 overflow-hidden">
          {selectedTicket ? (
            <TicketDetails ticket={selectedTicket} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">Selecione um ticket</p>
                <p className="text-sm">Clique em um ticket da lista para ver os detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
