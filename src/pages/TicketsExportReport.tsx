import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Search, FileSpreadsheet, Loader2 } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { useTicketsExportReport, TicketExportFilters } from "@/hooks/useTicketsExportReport";
import { useExportTicketsExcel } from "@/hooks/useExportTicketsExcel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STATUS_MAP: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  pending: "Pendente",
  resolved: "Resolvido",
  closed: "Fechado",
  cancelled: "Cancelado",
};

export default function TicketsExportReport() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<TicketExportFilters>({
    dateRange: undefined,
    departmentId: "all",
    agentIds: [],
    status: "all",
    priority: "all",
    search: "",
  });

  const { data, isLoading, totalCount, totalPages } = useTicketsExportReport(filters, page);
  const { exportToExcel } = useExportTicketsExcel();

  // Fetch departments and agents for filter selects
  const { data: departments } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name").order("name");
      return data ?? [];
    },
  });

  const INTERNAL_ROLES = [
    'admin', 'general_manager', 'manager', 'sales_rep', 'consultant',
    'support_agent', 'support_manager', 'financial_manager', 'financial_agent',
    'cs_manager', 'ecommerce_analyst'
  ] as const;

  const { data: agents } = useQuery({
    queryKey: ["internal-agents-list"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", INTERNAL_ROLES);

      const ids = roles?.map(r => r.user_id) || [];
      if (ids.length === 0) return [];

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
        .order("full_name");

      return data ?? [];
    },
  });

  const updateFilter = (key: keyof TicketExportFilters, value: any) => {
    setPage(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              Relatório de Tickets
            </h1>
            <p className="text-muted-foreground text-sm">
              Visualize e exporte dados de tickets com métricas de SLA
            </p>
          </div>
        </div>
        <Button onClick={() => exportToExcel(filters)} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <DatePickerWithRange
              date={filters.dateRange}
              onDateChange={(d) => updateFilter("dateRange", d)}
            />
            <Select value={filters.departmentId} onValueChange={(v) => updateFilter("departmentId", v)}>
              <SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Departamentos</SelectItem>
                {departments?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start gap-2 font-normal">
                  <Users className="h-4 w-4" />
                  {filters.agentIds.length === 0
                    ? "Todos Agentes"
                    : `${filters.agentIds.length} agente${filters.agentIds.length > 1 ? "s" : ""}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {agents?.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`agent-${a.id}`}
                        checked={filters.agentIds.includes(a.id)}
                        onCheckedChange={() => {
                          const next = filters.agentIds.includes(a.id)
                            ? filters.agentIds.filter((id) => id !== a.id)
                            : [...filters.agentIds, a.id];
                          updateFilter("agentIds", next);
                        }}
                      />
                      <label htmlFor={`agent-${a.id}`} className="text-sm cursor-pointer flex-1">
                        {a.full_name || "Sem nome"}
                      </label>
                    </div>
                  ))}
                  {(!agents || agents.length === 0) && (
                    <p className="text-sm text-muted-foreground">Nenhum agente encontrado</p>
                  )}
                </div>
                {filters.agentIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => updateFilter("agentIds", [])}
                  >
                    Limpar seleção
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.priority} onValueChange={(v) => updateFilter("priority", v)}>
              <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Prioridades</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar protocolo ou assunto..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {isLoading ? "Carregando..." : `${totalCount} tickets encontrados`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Dept. Resp.</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>1ª Resposta (min)</TableHead>
                  <TableHead>SLA Status</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 14 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      Nenhum ticket encontrado com os filtros selecionados
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, idx) => {
                    const sla = row.sla_resolution_time_value != null && row.resolution_minutes != null
                      ? (row.resolution_minutes <= (row.sla_resolution_time_unit === "hours" ? row.sla_resolution_time_value * 60 : row.sla_resolution_time_value) ? "✅ Dentro" : "❌ Violado")
                      : "—";
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{row.ticket_number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{row.subject}</TableCell>
                        <TableCell>{STATUS_MAP[row.status] || row.status}</TableCell>
                        <TableCell>{row.priority}</TableCell>
                        <TableCell>{row.category || "—"}</TableCell>
                        <TableCell>{row.contact_name || "—"}</TableCell>
                        <TableCell>{row.assigned_to_name || "—"}</TableCell>
                        <TableCell>{row.department_name || "—"}</TableCell>
                        <TableCell>{row.operation_name || "—"}</TableCell>
                        <TableCell>{row.origin_name || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell>{row.frt_minutes ?? "—"}</TableCell>
                        <TableCell>{sla}</TableCell>
                        <TableCell>{row.tags_list || "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
