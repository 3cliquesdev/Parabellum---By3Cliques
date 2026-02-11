import { useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

const MAX_EXPORT = 5000;

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
    
    // Show loading message in popup if available
    if (downloadWindow && !downloadWindow.closed) {
      try {
        downloadWindow.document.write('<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>Gerando planilha…</p></body></html>');
      } catch (_) { /* cross-origin fallback */ }
    }
    
    try {
      const endExclusive = new Date(filters.endDate);
      endExclusive.setDate(endExclusive.getDate() + 1);

      const { data, error } = await supabase.rpc("get_commercial_conversations_report", {
        p_start: filters.startDate.toISOString(),
        p_end: endExclusive.toISOString(),
        p_department_id: filters.departmentId || null,
        p_agent_id: filters.agentId || null,
        p_status: filters.status || null,
        p_channel: filters.channel || null,
        p_search: filters.search || null,
        p_limit: MAX_EXPORT,
        p_offset: 0,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("Nenhum dado para exportar");
        if (downloadWindow && !downloadWindow.closed) downloadWindow.close();
        return;
      }

      const rows = (data as any[]).map((r) => ({
        "ID": r.short_id || "",
        "Status": r.status === "open" ? "Aberta" : r.status === "closed" ? "Fechada" : r.status || "",
        "Nome": r.contact_name || "",
        "Email": r.contact_email || "",
        "Telefone": r.contact_phone || "",
        "Data Entrada": formatDate(r.created_at),
        "Hora Entrada": formatTime(r.created_at),
        "Data Encerramento": formatDate(r.closed_at),
        "Hora Encerramento": formatTime(r.closed_at),
        "Tempo Espera": formatDuration(r.waiting_time_seconds),
        "Duração": formatDuration(r.duration_seconds),
        "Responsável": r.assigned_agent_name || "",
        "Participantes": r.participants || "",
        "Grupo Responsável": r.department_name || "",
        "Total Interações": r.interactions_count ?? 0,
        "Origem": r.origin || "",
        "CSAT": r.csat_score ?? "",
        "Ticket": r.ticket_id || "",
        "Tags": Array.isArray(r.tags_all) ? r.tags_all.join(", ") : "",
        "Tempo Espera pós Atribuição": formatDuration(r.waiting_after_assignment_seconds),
        "Primeira Mensagem": r.first_customer_message || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      // Auto-width
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

      // Strategy 1: Use popup window (most reliable in iframes)
      if (downloadWindow && !downloadWindow.closed) {
        downloadWindow.location.href = url;
      } else {
        // Strategy 2: Anchor click fallback
        const a = document.createElement("a");
        a.href = url;
        a.download = `relatorio_conversas_${dateStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Delay revoke to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      const totalCount = (data as any[])[0]?.total_count ?? data.length;
      if (totalCount > MAX_EXPORT) {
        toast.success(`Exportados ${MAX_EXPORT.toLocaleString("pt-BR")} de ${Number(totalCount).toLocaleString("pt-BR")} registros (limite)`);
      } else {
        toast.success(`${data.length.toLocaleString("pt-BR")} conversas exportadas`);
      }
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
