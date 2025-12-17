import { useState } from "react";
import { useTickets } from "@/hooks/useTickets";
import { TicketsList } from "@/components/TicketsList";
import { TicketDetails } from "@/components/TicketDetails";
import { TicketCard } from "@/components/support/TicketCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Plus } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useUsers } from "@/hooks/useUsers";
import { useDepartments } from "@/hooks/useDepartments";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import { PageContainer } from "@/components/ui/page-container";
import { TicketFilterPopover, defaultTicketFilters, type TicketFilters } from "@/components/support/TicketFilterPopover";
import { CreateTicketDialog } from "@/components/support/CreateTicketDialog";

type FilterType = 'all' | 'mine' | 'unassigned';
type MobileView = 'list' | 'details';

export default function Support() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [ticketFilters, setTicketFilters] = useState<TicketFilters>(defaultTicketFilters);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { isSupportManager } = useUserRole();
  const { data: allUsers } = useUsers();
  const { data: departments } = useDepartments();
  const isMobile = useIsMobileBreakpoint();

  const { data: allTickets = [], isLoading } = useTickets(
    undefined, 
    filter, 
    selectedAgentId || undefined,
    ticketFilters
  );
  
  // Filter tickets by department
  const tickets = selectedDepartmentId
    ? allTickets.filter(t => t.department_id === selectedDepartmentId)
    : allTickets;
  
  // Filter support agents from all users
  const supportAgents = allUsers?.filter(u => u.role === 'support_agent' || u.role === 'support_manager') || [];

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);
  
  // Auto-select primeiro ticket se nenhum selecionado (desktop only)
  if (!isMobile && !selectedTicketId && tickets.length > 0) {
    setSelectedTicketId(tickets[0].id);
  }

  const handleSelectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    if (isMobile) {
      setMobileView('details');
    }
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  // Mobile Layout
  if (isMobile) {
    // Mobile: Details View
    if (mobileView === 'details' && selectedTicket) {
      return (
        <PageContainer>
          <div className="flex-none border-b border-border px-4 py-3 bg-card flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold truncate">Ticket #{selectedTicket.id.slice(0, 8)}</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <TicketDetails ticket={selectedTicket} />
          </div>
        </PageContainer>
      );
    }

    // Mobile: List View
    return (
      <PageContainer>
        <div className="flex-none border-b border-border p-4 space-y-3 bg-card">
          <h1 className="text-lg font-semibold text-foreground">Suporte</h1>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 text-xs">Todos</TabsTrigger>
              <TabsTrigger value="mine" className="flex-1 text-xs">Meus</TabsTrigger>
              <TabsTrigger value="unassigned" className="flex-1 text-xs">Não Atribuídos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {tickets.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8">
              <p className="text-muted-foreground text-center">Nenhum ticket encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border bg-card">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => handleSelectTicket(ticket.id)}
                  isSelected={ticket.id === selectedTicketId}
                />
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  // Desktop Layout
  return (
    <PageContainer>
      {/* Header */}
      <div className="flex-none border-b-2 border-slate-200 dark:border-border p-4 space-y-3 bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Suporte</h1>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Novo Ticket
          </Button>
        </div>

        {/* Assignment Tabs + Filters Row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="mine">Meus</TabsTrigger>
              <TabsTrigger value="unassigned">Não Atribuídos</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Department Filter */}
          <Select value={selectedDepartmentId || "all"} onValueChange={(v) => setSelectedDepartmentId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🏢 Todos Departamentos</SelectItem>
              {departments?.filter(d => d.is_active).map(dept => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Support Manager: Agent Filter */}
          {isSupportManager && (
            <Select value={selectedAgentId || "all"} onValueChange={(v) => setSelectedAgentId(v === "all" ? null : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ver fila de..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">👥 Todos Agentes</SelectItem>
                {supportAgents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.role === 'support_manager' ? '👔' : '🛡️'} {agent.full_name || agent.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Advanced Filters Row */}
        <TicketFilterPopover 
          filters={ticketFilters}
          onFiltersChange={setTicketFilters}
        />
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de Tickets (30%) */}
        <div className="w-[30%] border-r-2 border-slate-200 dark:border-border bg-card flex flex-col h-full overflow-hidden">
          <TicketsList
            tickets={tickets}
            selectedTicketId={selectedTicketId}
            onSelectTicket={handleSelectTicket}
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

      {/* Create Ticket Dialog */}
      <CreateTicketDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </PageContainer>
  );
}
