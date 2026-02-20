import { useState, useCallback } from "react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth } from "date-fns";
import { MessageSquare, ArrowLeft, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useDepartments } from "@/hooks/useDepartments";
import { useProfiles } from "@/hooks/useProfiles";
import { useCommercialConversationsReport } from "@/hooks/useCommercialConversationsReport";
import { useExportConversationsCSV } from "@/hooks/useExportConversationsCSV";
import { CommercialDetailedTable } from "@/components/reports/commercial/CommercialDetailedTable";
import { DateRange } from "react-day-picker";

const PAGE_SIZE = 50;

interface Filters {
  dateRange: DateRange;
  departmentId?: string;
  agentId?: string;
  status?: string;
  channel?: string;
  search: string;
}

const getDefaultFilters = (): Filters => ({
  dateRange: {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  },
  departmentId: undefined,
  agentId: undefined,
  status: undefined,
  channel: undefined,
  search: "",
});

export default function ConversationsReport() {
  const navigate = useNavigate();
  const departmentsQuery = useDepartments();
  const profilesQuery = useProfiles();

  const departments = departmentsQuery.data;
  const profiles = profilesQuery.data;

  // Pending filters (UI state)
  const [pending, setPending] = useState<Filters>(getDefaultFilters);
  // Applied filters (used by query)
  const [applied, setApplied] = useState<Filters>(getDefaultFilters);
  const [page, setPage] = useState(0);

  const handleApply = useCallback(() => {
    setApplied(pending);
    setPage(0);
  }, [pending]);

  const handleClear = useCallback(() => {
    const defaults = getDefaultFilters();
    setPending(defaults);
    setApplied(defaults);
    setPage(0);
  }, []);

  const baseFilters = {
    startDate: applied.dateRange?.from || startOfMonth(new Date()),
    endDate: applied.dateRange?.to || endOfMonth(new Date()),
    departmentId: applied.departmentId,
    agentId: applied.agentId,
    status: applied.status,
    channel: applied.channel,
  };

  const reportQuery = useCommercialConversationsReport({
    ...baseFilters,
    search: applied.search || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const { exportCSV, isExporting } = useExportConversationsCSV();

  const handleExport = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.info("Popups bloqueados. Permita popups para baixar a planilha.");
    }
    exportCSV({
      ...baseFilters,
      search: applied.search || undefined,
    }, { downloadWindow: w });
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            Relatório de Conversas
          </h1>
          <p className="text-muted-foreground mt-1">
            Lista detalhada de todas as conversas com filtros avançados e exportação
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg border items-end">
        <DateRangePicker
          value={pending.dateRange}
          onChange={(range) => {
            if (range?.from) setPending((p) => ({ ...p, dateRange: range }));
          }}
        />

        <Select
          value={pending.departmentId || "all"}
          onValueChange={(v) => setPending((p) => ({ ...p, departmentId: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Departamentos</SelectItem>
            {departments?.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={pending.agentId || "all"}
          onValueChange={(v) => setPending((p) => ({ ...p, agentId: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Agentes</SelectItem>
            {profiles?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={pending.status || "all"}
          onValueChange={(v) => setPending((p) => ({ ...p, status: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="open">Aberta</SelectItem>
            <SelectItem value="closed">Fechada</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={pending.channel || "all"}
          onValueChange={(v) => setPending((p) => ({ ...p, channel: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Canais</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="web_chat">Web Chat</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Buscar cliente..."
          value={pending.search}
          onChange={(e) => setPending((p) => ({ ...p, search: e.target.value }))}
          className="w-[200px]"
        />

        <div className="flex items-center gap-2">
          <Button onClick={handleApply} size="default">
            <Search className="h-4 w-4 mr-1" />
            Filtrar
          </Button>
          <Button variant="outline" onClick={handleClear} size="default">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Table */}
      <CommercialDetailedTable
        data={reportQuery.data}
        isLoading={reportQuery.isLoading}
        isError={reportQuery.isError}
        error={reportQuery.error as Error | null}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
}
