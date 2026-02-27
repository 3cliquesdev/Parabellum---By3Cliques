import { useState, useEffect, useCallback, useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTickets } from "@/hooks/useTickets";
import { TicketsTable } from "@/components/support/TicketsTable";
import { TicketsSidebar, type SidebarFilter } from "@/components/support/TicketsSidebar";
import { TicketDetails } from "@/components/TicketDetails";
import { TicketCard } from "@/components/support/TicketCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import { PageContainer } from "@/components/ui/page-container";
import { CreateTicketDialog } from "@/components/support/CreateTicketDialog";
import { useTicketsPresence } from "@/hooks/useTicketsPresence";
import { TicketsBulkActionsBar } from "@/components/support/TicketsBulkActionsBar";
import { BulkMoveToProjectDialog } from "@/components/support/BulkMoveToProjectDialog";
import { BulkTransferTicketsDialog } from "@/components/support/BulkTransferTicketsDialog";
import { useBulkArchiveTickets } from "@/hooks/useBulkArchiveTickets";
import { TicketFilterPopover, TicketFilters, defaultTicketFilters } from "@/components/support/TicketFilterPopover";
import { useSavedTicketFilters } from "@/hooks/useSavedTicketFilters";
import { SaveTicketFilterDialog } from "@/components/support/SaveTicketFilterDialog";
import { useActiveTicketStatuses } from "@/hooks/useTicketStatuses";

type MobileView = 'list' | 'details';

const TICKETS_PER_PAGE = 20;
const TICKET_FILTERS_STORAGE_KEY = 'ticket-filters-session';

export default function Support() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL only (sessionStorage restored via useEffect)
  const getInitialFromUrl = () => {
    const filterFromUrl = searchParams.get('filter') as SidebarFilter;
    const filtersFromUrl = searchParams.get('filters');
    
    if (filterFromUrl || filtersFromUrl) {
      let advFilters = defaultTicketFilters;
      if (filtersFromUrl) {
        try {
          advFilters = { ...defaultTicketFilters, ...JSON.parse(filtersFromUrl) };
        } catch {
          advFilters = defaultTicketFilters;
        }
      }
      return {
        sidebarFilter: filterFromUrl || 'all',
        advancedFilters: advFilters,
        fromUrl: true,
      };
    }
    return {
      sidebarFilter: 'all' as SidebarFilter,
      advancedFilters: defaultTicketFilters,
      fromUrl: false,
    };
  };

  // Only run once on mount
  const [initialFromUrl] = useState(getInitialFromUrl);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(initialFromUrl.sidebarFilter);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [moveToProjectOpen, setMoveToProjectOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<TicketFilters>(initialFromUrl.advancedFilters);
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  
  // Flag to control restoration - starts as true if came from URL (skip restoration)
  const [restoredFromSession, setRestoredFromSession] = useState(initialFromUrl.fromUrl);
  
  // Function to save filters to sessionStorage before navigating
  const saveFiltersToSession = useCallback(() => {
    const filtersState = {
      sidebarFilter,
      advancedFilters,
      searchTerm,
      currentPage,
    };
    sessionStorage.setItem(TICKET_FILTERS_STORAGE_KEY, JSON.stringify(filtersState));
  }, [sidebarFilter, advancedFilters, searchTerm, currentPage]);

  // Restore filters from sessionStorage (once, only if not from URL)
  useEffect(() => {
    if (restoredFromSession) return;
    
    const saved = sessionStorage.getItem(TICKET_FILTERS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSidebarFilter(parsed.sidebarFilter || 'all');
        setAdvancedFilters(parsed.advancedFilters || defaultTicketFilters);
        setSearchTerm(parsed.searchTerm || '');
        setCurrentPage(parsed.currentPage || 1);
      } catch (e) {
        console.error('Failed to restore ticket filters:', e);
      }
      sessionStorage.removeItem(TICKET_FILTERS_STORAGE_KEY);
    }
    setRestoredFromSession(true);
  }, [restoredFromSession]);

  // Sync filters to URL (only after restoration is complete)
  useEffect(() => {
    if (!restoredFromSession) return;
    
    const params = new URLSearchParams();
    
    if (sidebarFilter !== 'all') {
      params.set('filter', sidebarFilter);
    }
    
    const hasAdvancedFilters = JSON.stringify(advancedFilters) !== JSON.stringify(defaultTicketFilters);
    if (hasAdvancedFilters) {
      params.set('filters', JSON.stringify(advancedFilters));
    }
    
    setSearchParams(params, { replace: true });
  }, [sidebarFilter, advancedFilters, setSearchParams, restoredFromSession]);
  
  // Debounce search to avoid querying on every keystroke
  const debouncedSearch = useDebouncedValue(advancedFilters.search, 500);
  
  const { isSupportManager } = useUserRole();
  const isMobile = useIsMobileBreakpoint();
  const { getViewersForTicket, setViewingTicket } = useTicketsPresence();
  const bulkArchive = useBulkArchiveTickets();
  const { data: savedFilters } = useSavedTicketFilters();
  const { data: activeStatuses } = useActiveTicketStatuses();
  
  // Dynamic active status names (non-archived) for default filtering
  const activeStatusNames = useMemo(() => 
    activeStatuses?.filter(s => !s.is_archived_status).map(s => s.name) || ['open', 'in_progress', 'waiting_customer'],
    [activeStatuses]
  );

  // Apply saved filter when selected
  useEffect(() => {
    if (sidebarFilter.startsWith('saved:') && savedFilters) {
      const filterId = sidebarFilter.replace('saved:', '');
      const savedFilter = savedFilters.find(f => f.id === filterId);
      if (savedFilter) {
        setAdvancedFilters(savedFilter.filters);
      }
    }
  }, [sidebarFilter, savedFilters]);
  

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

  // Convert sidebar filter to hook parameters, merging with advanced filters (debounced)
  const debouncedFilters = useMemo(() => ({
    ...advancedFilters,
    search: debouncedSearch,
  }), [advancedFilters, debouncedSearch]);

  const getHookParams = () => {
    // Base filters from advanced popover with debounced search
    const baseFilters: TicketFilters = {
      ...debouncedFilters,
      search: debouncedFilters.search || searchTerm,
    };

    // BUSCA GLOBAL: quando há termo de busca, ignorar sidebar completamente
    // Isso garante que admins/gerentes encontrem qualquer ticket independente do filtro lateral
    const hasActiveSearch = !!(baseFilters.search && baseFilters.search.trim().length > 0);
    if (hasActiveSearch) {
      return { advancedFilters: baseFilters }; // Sem assignedFilter, sem status default
    }

    // Check if it's a dynamic status from the database
    const isDynamicStatus = activeStatuses?.some(s => s.name === sidebarFilter);
    
    switch (sidebarFilter) {
      case 'my_open':
        return { 
          assignedFilter: 'mine' as const,
          advancedFilters: { ...baseFilters, status: baseFilters.status.length > 0 ? baseFilters.status : activeStatusNames }
        };
      case 'created_by_me':
        return { 
          assignedFilter: 'created_by_me' as const,
          advancedFilters: { ...baseFilters } // Não forçar filtro de status - mostra todos (ativos + arquivados)
        };
      case 'unassigned':
        return { assignedFilter: 'unassigned' as const, advancedFilters: baseFilters };
      case 'sla_expired':
        return { advancedFilters: { ...baseFilters, slaExpired: true } };
      case 'no_tags':
        return { advancedFilters: { ...baseFilters, noTags: true, status: baseFilters.status.length > 0 ? baseFilters.status : activeStatusNames } };
      case 'archived':
        // Get archived status names dynamically
        const archivedStatusNames = activeStatuses?.filter(s => s.is_archived_status).map(s => s.name) || ['resolved', 'closed'];
        return { advancedFilters: { ...baseFilters, status: archivedStatusNames } };
      case 'financial_pending':
        return { advancedFilters: { ...baseFilters, status: ['pending_approval'] } };
      case 'all':
        // Se há busca ativa e nenhum status selecionado manualmente, buscar em TODOS os status
        const hasActiveSearch = !!(baseFilters.search && baseFilters.search.trim().length > 0);
        const hasManualStatusFilter = baseFilters.status.length > 0;
        if (hasActiveSearch && !hasManualStatusFilter) {
          return { advancedFilters: { ...baseFilters } }; // Busca global sem filtro de status
        }
        return { advancedFilters: { ...baseFilters, status: hasManualStatusFilter ? baseFilters.status : activeStatusNames } };
      default:
        // Handle dynamic status from database
        if (isDynamicStatus) {
          return { advancedFilters: { ...baseFilters, status: [sidebarFilter] } };
        }
        // Handle saved filters (saved:xxx)
        if (sidebarFilter.startsWith('saved:')) {
          return { advancedFilters: baseFilters };
        }
        return { advancedFilters: baseFilters };
    }
  };

  const hookParams = getHookParams();
  const { data: allTickets = [], isLoading } = useTickets(
    undefined,
    hookParams.assignedFilter || 'all',
    undefined,
    hookParams.advancedFilters
  );

  // Pagination (filtering is done in the hook now)
  const totalTickets = allTickets.length;
  const totalPages = Math.ceil(totalTickets / TICKETS_PER_PAGE);
  const startIndex = (currentPage - 1) * TICKETS_PER_PAGE;
  const endIndex = Math.min(startIndex + TICKETS_PER_PAGE, totalTickets);
  const paginatedTickets = allTickets.slice(startIndex, endIndex);

  const selectedTicket = allTickets.find((t) => t.id === selectedTicketId);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sidebarFilter, advancedFilters]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input - allow native browser shortcuts (Ctrl+V, Ctrl+X, etc.)
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) {
        return;
      }

      // Ctrl/Cmd + A: Select all tickets on the page
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (selectedTicketIds.length === paginatedTickets.length) {
          setSelectedTicketIds([]);
        } else {
          setSelectedTicketIds(paginatedTickets.map(t => t.id));
        }
      }

      // Ctrl/Cmd + C: Copy selected ticket numbers
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedTicketIds.length > 0) {
        e.preventDefault();
        const ticketNumbers = allTickets
          .filter(t => selectedTicketIds.includes(t.id))
          .map(t => t.ticket_number || t.id)
          .join('\n');
        navigator.clipboard.writeText(ticketNumbers);
        toast.success(`${selectedTicketIds.length} ticket(s) copiado(s)`);
      }

      // Tab: Navigate to next ticket
      if (e.key === 'Tab' && !e.shiftKey && paginatedTickets.length > 0) {
        e.preventDefault();
        const currentIndex = paginatedTickets.findIndex(t => t.id === selectedTicketId);
        const nextIndex = currentIndex < paginatedTickets.length - 1 ? currentIndex + 1 : 0;
        setSelectedTicketId(paginatedTickets[nextIndex]?.id || null);
      }

      // Shift + Tab: Navigate to previous ticket
      if (e.key === 'Tab' && e.shiftKey && paginatedTickets.length > 0) {
        e.preventDefault();
        const currentIndex = paginatedTickets.findIndex(t => t.id === selectedTicketId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : paginatedTickets.length - 1;
        setSelectedTicketId(paginatedTickets[prevIndex]?.id || null);
      }

      // Enter: Open selected ticket
      if (e.key === 'Enter' && selectedTicketId) {
        e.preventDefault();
        // Navigate directly instead of using handleSelectTicket
        if (isMobile) {
          setMobileView('details');
        } else {
          saveFiltersToSession();
          navigate(`/support/${selectedTicketId}`);
        }
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        setSelectedTicketIds([]);
        setSelectedTicketId(null);
      }

      // Arrow Down: Next ticket
      if (e.key === 'ArrowDown' && paginatedTickets.length > 0) {
        e.preventDefault();
        const currentIndex = paginatedTickets.findIndex(t => t.id === selectedTicketId);
        const nextIndex = Math.min(currentIndex + 1, paginatedTickets.length - 1);
        setSelectedTicketId(paginatedTickets[nextIndex]?.id || paginatedTickets[0]?.id);
      }

      // Arrow Up: Previous ticket
      if (e.key === 'ArrowUp' && paginatedTickets.length > 0) {
        e.preventDefault();
        const currentIndex = paginatedTickets.findIndex(t => t.id === selectedTicketId);
        const prevIndex = Math.max(currentIndex - 1, 0);
        setSelectedTicketId(paginatedTickets[prevIndex]?.id || paginatedTickets[0]?.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTicketIds, paginatedTickets, selectedTicketId, allTickets, isMobile, navigate, saveFiltersToSession]);

  const handleSelectTicket = useCallback((ticketId: string) => {
    if (isMobile) {
      setSelectedTicketId(ticketId);
      setMobileView('details');
    } else {
      // Desktop: save filters before navigating to full page
      saveFiltersToSession();
      navigate(`/support/${ticketId}`);
    }
  }, [isMobile, navigate, saveFiltersToSession]);

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
          {allTickets.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8">
              <p className="text-muted-foreground text-center">Nenhum ticket encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border bg-card">
              {allTickets.map((ticket) => (
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
            {/* Filtros Avançados */}
            <div data-tour="tickets-filter-popover" className="flex items-center gap-2">
              <TicketFilterPopover 
                filters={advancedFilters} 
                onFiltersChange={setAdvancedFilters} 
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSaveFilterOpen(true)}
                title="Salvar filtro atual"
              >
                Salvar Filtro
              </Button>
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

            <Button onClick={() => setCreateDialogOpen(true)} size="sm" data-tour="tickets-create-button">
              <Plus className="w-4 h-4 mr-2" />
              Novo Ticket
            </Button>
          </div>
        </div>
      </div>

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (200px) */}
        <div className="w-[200px] flex-shrink-0 overflow-hidden" data-tour="tickets-sidebar">
          <TicketsSidebar 
            selectedFilter={sidebarFilter}
            onFilterChange={setSidebarFilter}
          />
        </div>

        {/* Tickets Table - Full width now */}
        <div className="flex-1 min-w-0 overflow-hidden" data-tour="tickets-table">
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
      
      <SaveTicketFilterDialog 
        open={saveFilterOpen} 
        onOpenChange={setSaveFilterOpen} 
        filters={advancedFilters} 
      />

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
