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
  search?: string;
}

interface ExportOptions {
  downloadWindow?: Window | null;
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

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function useExportConversationsCSV() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = useCallback(async (filters: ExportFilters, options?: ExportOptions) => {
    setIsExporting(true);
    const downloadWindow = options?.downloadWindow;
    
    if (downloadWindow && !downloadWindow.closed) {
      try {
        downloadWindow.document.write('<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Gerando planilha…</p></body></html>');
      } catch (_) { /* cross-origin fallback */ }
    }
    
    try {
      const endExclusive = new Date(filters.endDate);
      endExclusive.setDate(endExclusive.getDate() + 1);

      const data = await fetchAllRpcPages({
        rpcName: "get_commercial_conversations_report",
        params: {
          p_start: filters.startDate.toISOString(),
          p_end: endExclusive.toISOString(),
          p_department_id: filters.departmentId || null,
          p_agent_id: filters.agentId || null,
          p_status: filters.status || null,
          p_channel: filters.channel || null,
          p_search: filters.search || null,
        },
      });

      if (!data || data.length === 0) {
        toast.info("Nenhum dado para exportar");
        if (downloadWindow && !downloadWindow.closed) downloadWindow.close();
        return;
      }

      const rows = (data as any[]).map((r) => ({
        "Protocolo": r.short_id ? `#${r.short_id}` : "",
        "ID Conversa": r.conversation_id || "",
        "Status": r.status === "open" ? "Aberta" : r.status === "closed" ? "Fechada" : r.status || "",
        "Nome": r.contact_name || "",
        "Email": r.contact_email || "",
        "Telefone": r.contact_phone || "",
        "Data Entrada": formatDate(r.created_at),
        "Hora Entrada": formatTime(r.created_at),
        "Data Encerramento": formatDate(r.closed_at),
        "Hora Encerramento": formatTime(r.closed_at),
        "Data Handoff": r.handoff_at ? formatDate(r.handoff_at) : "",
        "Hora Handoff": r.handoff_at ? formatTime(r.handoff_at) : "",
        "Tempo Espera": formatDuration(r.waiting_time_seconds),
        "Tempo Espera pós Atribuição": formatDuration(r.waiting_after_assignment_seconds),
        "Tempo 1ª Resposta Humana": formatDuration(r.human_first_response_seconds),
        "Duração": formatDuration(r.duration_seconds),
        "Tempo Resolução Humana": formatDuration(r.human_resolution_seconds),
        "Responsável": r.assigned_agent_name || "",
        "Participantes": r.participants || "",
        "Grupo Responsável": r.department_name || "",
        "Total Interações": r.interactions_count ?? 0,
        "Origem": r.origin || "",
        "CSAT": r.csat_score ?? "",
        "Ticket": r.ticket_id || "",
        "Tags": Array.isArray(r.tags_all) ? r.tags_all.join(", ") : "",
        "Primeira Mensagem": r.first_customer_message || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      const colWidths = Object.keys(rows[0]).map((key) => {
        const maxLen = Math.max(key.length, ...rows.map((r: any) => String(r[key] ?? "").length));
        return { wch: Math.min(maxLen + 2, 60) };
      });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Conversas");

      const dateStr = new Date().toISOString().slice(0, 10);
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);

      if (downloadWindow && !downloadWindow.closed) {
        downloadWindow.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `relatorio_conversas_${dateStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      toast.success(`${data.length.toLocaleString("pt-BR")} conversas exportadas`);
    } catch (err) {
      console.error("[ExportConversations] Error:", err);
      toast.error("Erro ao exportar dados");
      if (downloadWindow && !downloadWindow.closed) downloadWindow.close();
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportCSV, isExporting };
}
