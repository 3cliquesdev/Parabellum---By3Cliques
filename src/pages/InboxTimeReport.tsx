import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Clock } from "lucide-react";
import { subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { PageContainer, PageHeader, PageContent, PageFilters } from "@/components/ui/page-container";
import { InboxTimeKPICards } from "@/components/reports/inbox/InboxTimeKPICards";
import { InboxTimeTable } from "@/components/reports/inbox/InboxTimeTable";
import { useInboxTimeReport, type InboxTimeFilters } from "@/hooks/useInboxTimeReport";
import { useExportInboxTimeCSV } from "@/hooks/useExportInboxTimeCSV";
import { useTags } from "@/hooks/useTags";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function InboxTimeReport() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [departmentId, setDepartmentId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [tagId, setTagId] = useState("");
  const [transferred, setTransferred] = useState("");
  const [search, setSearch] = useState("");

  const filters: InboxTimeFilters = {
    startDate: dateRange?.from ?? subDays(new Date(), 30),
    endDate: dateRange?.to ?? new Date(),
    departmentId: departmentId || undefined,
    agentId: agentId || undefined,
    status: status || undefined,
    channel: channel || undefined,
    tagId: tagId || undefined,
    transferred: transferred || undefined,
    search: search || undefined,
  };

  const { data, isLoading } = useInboxTimeReport(filters, page, pageSize);
  const { exportCSV, isExporting } = useExportInboxTimeCSV();
  const { data: tags } = useTags();

  const { data: departments } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <PageContainer>
      <PageHeader title="Relatório de Tempo Médio" description="Métricas de SLA e tempos de atendimento por conversa">
        <Button variant="ghost" size="sm" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          onClick={() => exportCSV(filters)}
        >
          <Download className="h-4 w-4 mr-1" />
          {isExporting ? "Exportando..." : "Excel"}
        </Button>
      </PageHeader>

      <PageFilters>
        <div className="flex flex-wrap gap-3 items-end">
          <DatePickerWithRange date={dateRange} onDateChange={(d) => { setDateRange(d); setPage(0); }} />

          <Select value={channel} onValueChange={(v) => { setChannel(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="webchat">Webchat</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="closed">Fechada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={agentId} onValueChange={(v) => { setAgentId(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Agente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {agents?.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={tagId} onValueChange={(v) => { setTagId(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas tags</SelectItem>
              {tags?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={transferred} onValueChange={(v) => { setTransferred(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Transferido" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Buscar protocolo, nome, telefone..."
            className="w-[250px]"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
      </PageFilters>

      <PageContent>
        <div className="space-y-6">
          <InboxTimeKPICards data={data} isLoading={isLoading} />
          <InboxTimeTable data={data} isLoading={isLoading} page={page} pageSize={pageSize} onPageChange={setPage} />
        </div>
      </PageContent>
    </PageContainer>
  );
}
