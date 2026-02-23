import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { TicketExportFilters, TicketExportRow } from "./useTicketsExportReport";
import { toast } from "sonner";
import { fetchAllRpcPages } from "@/lib/fetchAllRpcPages";

const STATUS_MAP: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  pending: "Pendente",
  resolved: "Resolvido",
  closed: "Fechado",
  cancelled: "Cancelado",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtSla(value: number | null, unit: string | null): string {
  if (value == null || !unit) return "";
  return `${value} ${unit === "minutes" ? "min" : unit === "hours" ? "h" : unit}`;
}

function slaStatus(row: TicketExportRow): string {
  if (row.sla_resolution_time_value == null || row.resolution_minutes == null) return "";
  let targetMinutes = row.sla_resolution_time_value;
  if (row.sla_resolution_time_unit === "hours") targetMinutes *= 60;
  return row.resolution_minutes <= targetMinutes ? "Dentro do SLA" : "SLA Violado";
}

export function useExportTicketsExcel() {
  const exportToExcel = async (filters: TicketExportFilters) => {
    toast.info("Gerando Excel...");

    try {
      const params: Record<string, any> = {};
      if (filters.dateRange?.from) {
        const d = filters.dateRange.from;
        params.p_start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T00:00:00`;
      }
      if (filters.dateRange?.to) {
        const d = filters.dateRange.to;
        params.p_end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T23:59:59`;
      }
      if (filters.departmentId && filters.departmentId !== "all") params.p_department_id = filters.departmentId;
      if (filters.agentIds && filters.agentIds.length > 0) params.p_agent_ids = filters.agentIds;
      if (filters.status && filters.status !== "all") params.p_status = filters.status;
      if (filters.priority && filters.priority !== "all") params.p_priority = filters.priority;
      if (filters.search) params.p_search = filters.search;

      const rows = (await fetchAllRpcPages<TicketExportRow>({
        rpcName: "get_tickets_export_report",
        params,
      }));

      if (!rows.length) {
        toast.warning("Nenhum dado para exportar");
        return;
      }

      const excelRows = rows.map((r) => ({
        "Protocolo": r.ticket_number,
        "Assunto": r.subject,
        "Status": STATUS_MAP[r.status] || r.status,
        "Prioridade": r.priority,
        "Categoria": r.category || "",
        "Solicitante (Nome)": r.contact_name,
        "Solicitante (Email)": r.contact_email,
        "Solicitante (Telefone)": r.contact_phone,
        "Responsável": r.assigned_to_name,
        "Dept. Solicitante": r.requesting_department_name,
        "Dept. Responsável": r.department_name,
        "Operação": r.operation_name,
        "Origem": r.origin_name,
        "Canal": r.channel || "",
        "Data Criação": fmtDate(r.created_at),
        "Hora Criação": fmtTime(r.created_at),
        "Data Resolução": fmtDate(r.resolved_at),
        "Hora Resolução": fmtTime(r.resolved_at),
        "Tempo 1ª Resposta (min)": r.frt_minutes ?? "",
        "SLA Meta Resposta": fmtSla(r.sla_response_time_value, r.sla_response_time_unit),
        "SLA Meta Resolução": fmtSla(r.sla_resolution_time_value, r.sla_resolution_time_unit),
        "SLA Status": slaStatus(r),
        "Due Date": fmtDate(r.due_date),
        "Tags": r.tags_list || "",
      }));

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tickets");

      const colWidths = Object.keys(excelRows[0]).map((key) => ({
        wch: Math.max(key.length, ...excelRows.map((r) => String((r as any)[key] || "").length)) + 2,
      }));
      ws["!cols"] = colWidths;

      XLSX.writeFile(wb, `relatorio-tickets-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${rows.length.toLocaleString("pt-BR")} tickets exportados com sucesso!`);
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar: " + err.message);
    }
  };

  return { exportToExcel };
}
