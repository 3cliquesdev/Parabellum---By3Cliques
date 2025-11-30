import { useState } from "react";
import { useTickets } from "@/hooks/useTickets";
import { TicketsList } from "@/components/TicketsList";
import { TicketDetails } from "@/components/TicketDetails";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useUsers } from "@/hooks/useUsers";
import { useDepartments } from "@/hooks/useDepartments";

type FilterType = 'all' | 'mine' | 'unassigned';

export default function Support() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const { isSupportManager } = useUserRole();
  const { data: allUsers } = useUsers();
  const { data: departments } = useDepartments();

  const { data: allTickets = [], isLoading } = useTickets(undefined, filter, selectedAgentId || undefined);
  
  // Filter tickets by department
  const tickets = selectedDepartmentId
    ? allTickets.filter(t => t.department_id === selectedDepartmentId)
    : allTickets;
  
  // Filter support agents from all users
  const supportAgents = allUsers?.filter(u => u.role === 'support_agent' || u.role === 'support_manager') || [];

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);
  
  // Auto-select primeiro ticket se nenhum selecionado
  if (!selectedTicketId && tickets.length > 0) {
    setSelectedTicketId(tickets[0].id);
  }

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
      <div className="border-b-2 border-slate-200 dark:border-border p-4 space-y-3 bg-card">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Suporte</h1>
        </div>

        <div className="flex items-center gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="flex-1">
            <TabsList>
              <TabsTrigger value="all">Todos os Tickets</TabsTrigger>
              <TabsTrigger value="mine">Meus Tickets</TabsTrigger>
              <TabsTrigger value="unassigned">Não Atribuídos</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Department Filter */}
          <Select value={selectedDepartmentId || "all"} onValueChange={(v) => setSelectedDepartmentId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🏢 Todos os Departamentos</SelectItem>
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
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Ver fila de..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">👥 Todos os Agentes</SelectItem>
                {supportAgents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.role === 'support_manager' ? '👔' : '🛡️'} {agent.full_name || agent.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de Tickets (30%) */}
        <div className="w-[30%] border-r-2 border-slate-200 dark:border-border bg-card flex flex-col h-full overflow-hidden">
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
