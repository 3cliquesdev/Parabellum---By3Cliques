import { useState, useMemo, useEffect } from "react";
import { startOfMonth, endOfMonth, addDays } from "date-fns";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useCommercialConversationsPivot } from "@/hooks/useCommercialConversationsPivot";
import { useCommercialConversationsKPIs } from "@/hooks/useCommercialConversationsKPIs";
import { useCommercialConversationsReport } from "@/hooks/useCommercialConversationsReport";
import { useExportCommercialConversationsCSV } from "@/hooks/useExportCommercialConversationsCSV";
import { CommercialKPICards } from "@/components/reports/commercial/CommercialKPICards";
import { CommercialPivotTable } from "@/components/reports/commercial/CommercialPivotTable";
import { CommercialDrilldownModal } from "@/components/reports/commercial/CommercialDrilldownModal";
import { CommercialDetailedTable } from "@/components/reports/commercial/CommercialDetailedTable";
import { DateRange } from "react-day-picker";

const PAGE_SIZE = 50;

export default function CommercialConversationsReport() {
  const navigate = useNavigate();
  const departmentsQuery = useDepartments();
  const profilesQuery = useProfiles();
  
  const departments = departmentsQuery.data;
  const profiles = profilesQuery.data;

  // Find Comercial department as default
  const comercialDept = useMemo(() => 
    departments?.find(d => d.name?.toLowerCase().includes("comercial")),
    [departments]
  );

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [agentId, setAgentId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [channel, setChannel] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Set default department when loaded
  useEffect(() => {
    if (comercialDept && !departmentId) {
      setDepartmentId(comercialDept.id);
    }
  }, [comercialDept, departmentId]);

  // Drilldown state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownFilters, setDrilldownFilters] = useState<{
    departmentId: string | null;
    categoryId: string | null;
    noTag: boolean;
  } | null>(null);

  // Build filters object
  const baseFilters = {
    startDate: dateRange?.from || startOfMonth(new Date()),
    endDate: addDays(dateRange?.to || endOfMonth(new Date()), 1), // End exclusive
    departmentId: departmentId || undefined,
    agentId: agentId || undefined,
    status: status || undefined,
    channel: channel || undefined,
  };

  // Queries
  const kpisQuery = useCommercialConversationsKPIs(baseFilters);
  const pivotQuery = useCommercialConversationsPivot(baseFilters);
  const reportQuery = useCommercialConversationsReport({
    ...baseFilters,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const { exportCSV, isExporting } = useExportCommercialConversationsCSV();

  // Handlers
  const handleCellClick = (deptId: string | null, catId: string | null, noTag: boolean) => {
    setDrilldownFilters({ departmentId: deptId, categoryId: catId, noTag });
    setDrilldownOpen(true);
  };

  const handleExport = () => {
    exportCSV({
      ...baseFilters,
      search: search || undefined,
    });
  };

  const handleDateChange = (range: DateRange | undefined) => {
    if (range?.from) {
      setDateRange(range);
      setPage(0);
    }
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
            Relatório de Conversas Comerciais
          </h1>
          <p className="text-muted-foreground mt-1">
            Análise de conversas por departamento e categoria com métricas de atendimento
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg border">
        <DateRangePicker
          value={dateRange}
          onChange={handleDateChange}
        />

        <Select value={departmentId || "all"} onValueChange={(v) => { setDepartmentId(v === "all" ? undefined : v); setPage(0); }}>
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

        <Select value={agentId || "all"} onValueChange={(v) => { setAgentId(v === "all" ? undefined : v); setPage(0); }}>
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

        <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? undefined : v); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="open">Aberta</SelectItem>
            <SelectItem value="closed">Fechada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={channel || "all"} onValueChange={(v) => { setChannel(v === "all" ? undefined : v); setPage(0); }}>
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
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-[200px]"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="space-y-6">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="completo">Completo</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          <CommercialKPICards 
            data={kpisQuery.data} 
            isLoading={kpisQuery.isLoading}
            isError={kpisQuery.isError}
            error={kpisQuery.error as Error | null}
          />
          <CommercialPivotTable
            data={pivotQuery.data}
            isLoading={pivotQuery.isLoading}
            onCellClick={handleCellClick}
          />
        </TabsContent>

        <TabsContent value="completo">
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
        </TabsContent>
      </Tabs>

      {/* Drilldown Modal */}
      {drilldownFilters && (
        <CommercialDrilldownModal
          open={drilldownOpen}
          onOpenChange={setDrilldownOpen}
          filters={{
            ...baseFilters,
            departmentId: drilldownFilters.departmentId || undefined,
            categoryId: drilldownFilters.categoryId || undefined,
            noTag: drilldownFilters.noTag,
          }}
          title={`Conversas: ${drilldownFilters.noTag ? "Sem Tag" : "Categoria selecionada"}`}
        />
      )}
    </div>
  );
}
