import { useState, useCallback } from "react";
import { toast } from "sonner";
import { fetchAllRpcPages } from "@/lib/fetchAllRpcPages";
import * as XLSX from "xlsx";

interface ExportFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  agentId?: string;
  status?: string;
  channel?: string;
  tagId?: string;
  transferred?: string;
  search?: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR");
}

export function useExportInboxTimeCSV() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = useCallback(async (filters: ExportFilters) => {
    setIsExporting(true);
    try {
      const endExclusive = new Date(filters.endDate);
      endExclusive.setDate(endExclusive.getDate() + 1);

      const data = await fetchAllRpcPages({
        rpcName: "get_inbox_time_report",
        params: {
          p_start: filters.startDate.toISOString(),
          p_end: endExclusive.toISOString(),
          p_department_id: filters.departmentId || null,
          p_agent_id: filters.agentId || null,
          p_status: filters.status || null,
          p_channel: filters.channel || null,
          p_tag_id: filters.tagId || null,
          p_transferred: filters.transferred || null,
          p_search: filters.search || null,
        },
      });

      if (!data || data.length === 0) {
        toast.info("Nenhum dado para exportar");
        return;
      }

      const rows = (data as any[]).map((r) => ({
        "Protocolo": r.short_id ? `#${r.short_id}` : "",
        "ID Conversa": r.conversation_id || "",
        "Canal": r.channel || "",
        "Status": r.status === "open" ? "Aberta" : r.status === "closed" ? "Fechada" : r.status || "",
        "Contato": r.contact_name || "",
        "Telefone": r.contact_phone || "",
        "Atendente": r.assigned_agent_name || "",
        "Departamento": r.department_name || "",
        "1ª Msg Cliente": formatDateTime(r.customer_first_msg_at),
        "1ª Resposta IA": formatDateTime(r.ai_first_msg_at),
        "Handoff": formatDateTime(r.handoff_at),
        "1ª Msg Agente": formatDateTime(r.agent_first_msg_at),
        "Encerramento": formatDateTime(r.resolved_at),
        "SLA 1ª Resp IA": formatDuration(r.ai_first_response_sec),
        "Tempo IA": formatDuration(r.ai_duration_sec),
        "Tempo até Handoff": formatDuration(r.time_to_handoff_sec),
        "Fila Humano": formatDuration(r.human_pickup_sec),
        "Tempo Humano": formatDuration(r.human_resolution_sec),
        "Total Resolução": formatDuration(r.total_resolution_sec),
        "CSAT": r.csat_score ?? "",
        "Tags": Array.isArray(r.tags_all) ? r.tags_all.join(", ") : "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const colWidths = Object.keys(rows[0]).map((key) => {
        const maxLen = Math.max(key.length, ...rows.map((r: any) => String(r[key] ?? "").length));
        return { wch: Math.min(maxLen + 2, 60) };
      });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tempo Médio");

      const dateStr = new Date().toISOString().slice(0, 10);
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_tempo_medio_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      toast.success(`${data.length.toLocaleString("pt-BR")} conversas exportadas`);
    } catch (err) {
      console.error("[ExportInboxTime] Error:", err);
      toast.error("Erro ao exportar dados");
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportCSV, isExporting };
}
