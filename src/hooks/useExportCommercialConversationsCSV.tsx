import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export interface ExportFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  agentId?: string;
  status?: string;
  channel?: string;
  search?: string;
}

const MAX_EXPORT_ROWS = 5000;

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join(", ") : String(value);
  // Para formato brasileiro (separador ;), escapar se contiver ; ou " ou quebra de linha
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function useExportCommercialConversationsCSV() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = async (filters: ExportFilters) => {
    setIsExporting(true);
    
    try {
      const { data, error } = await supabase.rpc("get_commercial_conversations_report", {
        p_start: filters.startDate.toISOString(),
        p_end: filters.endDate.toISOString(),
        p_department_id: filters.departmentId || null,
        p_agent_id: filters.agentId || null,
        p_status: filters.status || null,
        p_channel: filters.channel || null,
        p_search: filters.search || null,
        p_limit: MAX_EXPORT_ROWS,
        p_offset: 0,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("Nenhum registro encontrado para exportar");
        return;
      }

      const headers = [
        "ID Curto",
        "ID Conversa",
        "Status",
        "Nome Contato",
        "Email",
        "Telefone",
        "Organização",
        "Criado em",
        "Fechado em",
        "Tempo de Espera",
        "Duração",
        "Agente Responsável",
        "Participantes",
        "Departamento",
        "Total Interações",
        "Origem",
        "CSAT",
        "Comentário CSAT",
        "Ticket ID",
        "Modo IA",
        "Tags",
        "Última Tag Conversa",
        "Primeira Mensagem",
        "Tempo Espera pós Atribuição",
      ];

      const rows = data.map((row: any) => [
        escapeCSV(row.short_id),
        escapeCSV(row.conversation_id),
        escapeCSV(row.status),
        escapeCSV(row.contact_name),
        escapeCSV(row.contact_email),
        escapeCSV(row.contact_phone),
        escapeCSV(row.contact_organization),
        row.created_at ? format(new Date(row.created_at), "dd/MM/yyyy HH:mm") : "",
        row.closed_at ? format(new Date(row.closed_at), "dd/MM/yyyy HH:mm") : "",
        formatDuration(row.waiting_time_seconds),
        formatDuration(row.duration_seconds),
        escapeCSV(row.assigned_agent_name),
        escapeCSV(row.participants),
        escapeCSV(row.department_name),
        String(row.interactions_count || 0),
        escapeCSV(row.origin),
        row.csat_score ? String(row.csat_score) : "",
        escapeCSV(row.csat_comment),
        escapeCSV(row.ticket_id),
        escapeCSV(row.bot_flow),
        escapeCSV(row.tags_all),
        escapeCSV(row.last_conversation_tag),
        escapeCSV(row.first_customer_message),
        formatDuration(row.waiting_after_assignment_seconds),
      ].join(";"));

      const BOM = "\uFEFF";
      // Formato brasileiro: separador ponto-e-vírgula
      const csvContent = BOM + headers.join(";") + "\n" + rows.join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conversas_comerciais_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalCount = data[0]?.total_count || data.length;
      if (totalCount > MAX_EXPORT_ROWS) {
        toast.success(`Exportados ${MAX_EXPORT_ROWS} de ${totalCount} registros (limite máximo)`);
      } else {
        toast.success(`Exportados ${data.length} registros com sucesso`);
      }
    } catch (error: any) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCSV, isExporting };
}
