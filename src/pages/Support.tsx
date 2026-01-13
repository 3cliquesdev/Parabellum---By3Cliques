import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTickets } from "@/hooks/useTickets";
import { TicketsTable } from "@/components/support/TicketsTable";
import { TicketsSidebar, type SidebarFilter } from "@/components/support/TicketsSidebar";
import { TicketDetails } from "@/components/TicketDetails";
import { TicketCard } from "@/components/support/TicketCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import { PageContainer } from "@/components/ui/page-container";
import { CreateTicketDialog } from "@/components/support/CreateTicketDialog";
import { useTicketsPresence } from "@/hooks/useTicketsPresence";
import { TicketsBulkActionsBar } from "@/components/support/TicketsBulkActionsBar";
import { BulkMoveToProjectDialog } from "@/components/support/BulkMoveToProjectDialog";
import { BulkTransferTicketsDialog } from "@/components/support/BulkTransferTicketsDialog";
import { useBulkArchiveTickets } from "@/hooks/useBulkArchiveTickets";

type MobileView = 'list' | 'details';

const TICKETS_PER_PAGE = 20;

export default function Support() {
  const navigate = useNavigate();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all');
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [moveToProjectOpen, setMoveToProjectOpen] = useState(false);
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  
  const { isSupportManager } = useUserRole();
  const isMobile = useIsMobileBreakpoint();
  const { getViewersForTicket, setViewingTicket } = useTicketsPresence();
  const bulkArchive = useBulkArchiveTickets();

  const handleBulkArchive = () => {
    bulkArchive.mutate(selectedTicketIds, {
      onSuccess: () => setSelectedTicketIds([]),
    });
  };

  const handleClearSelection = () => {
    setSelectedTicketIds([]);
  };

  // Atualizar presença quando selecionar ticket (mobile)
  useEffect(() => {
    if (isMobile && mobileView === 'details' && selectedTicketId) {
      setViewingTicket(selectedTicketId);
    } else if (isMobile) {
      setViewingTicket(null);
    }
  }, [isMobile, mobileView, selectedTicketId, setViewingTicket]);

  // Convert sidebar filter to hook parameters
  const getHookParams = () => {
    switch (sidebarFilter) {
      case 'my_open':
        return { 
          assignedFilter: 'mine' as const,
          advancedFilters: { search: '', status: ['open', 'in_progress', 'waiting_customer'], priority: [], category: [], channel: [], tags: [], dateRange: undefined, slaExpired: false, noTags: false }
        };
      case 'unassigned':
        return { assignedFilter: 'unassigned' as const };
      case 'sla_expired':
        return { advancedFilters: { search: '', status: [], priority: [], category: [], channel: [], tags: [], dateRange: undefined, slaExpired: true, noTags: false } };
      case 'no_tags':
        return { advancedFilters: { search: '', status: ['open', 'in_progress', 'waiting_customer'], priority: [], category: [], channel: [], tags: [], dateRange: undefined, slaExpired: false, noTags: true } };
      case 'archived':
        return { advancedFilters: { search: '', status: ['resolved', 'closed'], priority: [], category: [], channel: [], tags: [], dateRange: undefined, slaExpired: false, noTags: false } };
      case 'open':
      case 'in_progress':
      case 'waiting_customer':
      case 'resolved':
      case 'closed':
        return { advancedFilters: { search: '', status: [sidebarFilter], priority: [], category: [], channel: [], tags: [], dateRange: undefined, slaExpired: false, noTags: false } };
      case 'all':
        // "Todos" now excludes archived tickets
        return { advancedFilters: { search: '', status: ['open', 'in_progress', 'waiting_customer'], priority: [], category: [], channel: [], tags: [], dateRange: undefined, slaExpired: false, noTags: false } };
      default:
        return {};
    }
  };

  const hookParams = getHookParams();
  const { data: allTickets = [], isLoading } = useTickets(
    undefined,
    hookParams.assignedFilter || 'all',
    undefined,
    hookParams.advancedFilters
  );

  // Client-side search
  const filteredTickets = searchTerm
    ? allTickets.filter(ticket => {
        const search = searchTerm.toLowerCase();
        return (
          ticket.id.toLowerCase().includes(search) ||
          (ticket.ticket_number || '').toLowerCase().includes(search) ||
          ticket.subject.toLowerCase().includes(search) ||
          (ticket.customer?.first_name || '').toLowerCase().includes(search) ||
          (ticket.customer?.last_name || '').toLowerCase().includes(search) ||
          (ticket.customer?.email || '').toLowerCase().includes(search)
        );
      })
    : allTickets;

  // Pagination
  const totalTickets = filteredTickets.length;
  const totalPages = Math.ceil(totalTickets / TICKETS_PER_PAGE);
  const startIndex = (currentPage - 1) * TICKETS_PER_PAGE;
  const endIndex = Math.min(startIndex + TICKETS_PER_PAGE, totalTickets);
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  const selectedTicket = allTickets.find((t) => t.id === selectedTicketId);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sidebarFilter, searchTerm]);

  const handleSelectTicket = (ticketId: string) => {
    if (isMobile) {
      setSelectedTicketId(ticketId);
      setMobileView('details');
    } else {
      // Desktop: navigate to full page
      navigate(`/support/${ticketId}`);
    }
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  const handleToggleSelect = (ticketId: string) => {
    setSelectedTicketIds(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedTicketIds.length === paginatedTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(paginatedTickets.map(t => t.id));
    }
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
    if (mobileView === 'details' && selectedTicket) {
      return (
        <PageContainer>
          <div className="flex-none border-b border-border px-4 py-3 bg-card flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold truncate">
              Ticket #{selectedTicket.ticket_number || selectedTicket.id.slice(0, 8)}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <TicketDetails ticket={selectedTicket} />
          </div>
        </PageContainer>
      );
    }

    return (
      <PageContainer>
        <div className="flex-none border-b border-border p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-foreground">Tickets</h1>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar tickets..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8">
              <p className="text-muted-foreground text-center">Nenhum ticket encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border bg-card">
              {filteredTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => handleSelectTicket(ticket.id)}
                  isSelected={ticket.id === selectedTicketId}
                  viewers={getViewersForTicket(ticket.id)}
                />
              ))}
            </div>
          )}
        </div>
        <CreateTicketDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      </PageContainer>
    );
  }

  // Desktop Layout
  return (
    <PageContainer>
      {/* Header */}
      <div className="flex-none border-b border-border px-4 py-3 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground">Tickets</h1>
            <span className="text-sm text-muted-foreground">
              {startIndex + 1}-{endIndex} de {totalTickets} tickets
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar protocolo, assunto..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo Ticket
            </Button>
          </div>
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (200px) */}
        <div className="w-[200px] flex-shrink-0 overflow-hidden">
          <TicketsSidebar 
            selectedFilter={sidebarFilter}
            onFilterChange={setSidebarFilter}
          />
        </div>

        {/* Tickets Table - Full width now */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <TicketsTable
            tickets={paginatedTickets}
            selectedTicketId={selectedTicketId}
            onSelectTicket={handleSelectTicket}
            selectedTicketIds={selectedTicketIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            getViewersForTicket={getViewersForTicket}
          />
        </div>
      </div>

      <CreateTicketDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {/* Bulk Actions Bar */}
      {selectedTicketIds.length > 0 && (
        <TicketsBulkActionsBar
          selectedCount={selectedTicketIds.length}
          onClear={handleClearSelection}
          onMoveToProject={() => setMoveToProjectOpen(true)}
          onArchive={handleBulkArchive}
          onTransfer={() => setBulkTransferOpen(true)}
          isArchiving={bulkArchive.isPending}
        />
      )}

      {/* Bulk Action Dialogs */}
      <BulkMoveToProjectDialog
        open={moveToProjectOpen}
        onOpenChange={setMoveToProjectOpen}
        selectedTicketIds={selectedTicketIds}
        onSuccess={handleClearSelection}
      />

      <BulkTransferTicketsDialog
        open={bulkTransferOpen}
        onOpenChange={setBulkTransferOpen}
        selectedTicketIds={selectedTicketIds}
        onSuccess={handleClearSelection}
      />
    </PageContainer>
  );
}
