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

interface KPIData {
  total_conversations: number;
  total_open: number;
  total_closed: number;
  total_without_tag: number;
  avg_csat: number | null;
  avg_waiting_seconds: number | null;
  avg_duration_seconds: number | null;
}

interface PivotRow {
  department_id: string;
  department_name: string;
  category: string;
  conversation_count: number;
}

export function useExportCommercialConversationsCSV() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = async (filters: ExportFilters) => {
    setIsExporting(true);
    
    try {
      // Buscar KPIs, Pivot e Detalhado em paralelo
      const [kpisResult, pivotResult, reportResult] = await Promise.all([
        supabase.rpc("get_commercial_conversations_kpis", {
          p_start: filters.startDate.toISOString(),
          p_end: filters.endDate.toISOString(),
          p_department_id: filters.departmentId || null,
          p_agent_id: filters.agentId || null,
          p_status: filters.status || null,
          p_channel: filters.channel || null,
        }),
        supabase.rpc("get_commercial_conversations_pivot", {
          p_start: filters.startDate.toISOString(),
          p_end: filters.endDate.toISOString(),
          p_department_id: filters.departmentId || null,
          p_agent_id: filters.agentId || null,
          p_status: filters.status || null,
          p_channel: filters.channel || null,
        }),
        supabase.rpc("get_commercial_conversations_report", {
          p_start: filters.startDate.toISOString(),
          p_end: filters.endDate.toISOString(),
          p_department_id: filters.departmentId || null,
          p_agent_id: filters.agentId || null,
          p_status: filters.status || null,
          p_channel: filters.channel || null,
          p_search: filters.search || null,
          p_limit: MAX_EXPORT_ROWS,
          p_offset: 0,
        }),
      ]);

      if (reportResult.error) throw reportResult.error;

      const kpis: KPIData = kpisResult.data?.[0] || {
        total_conversations: 0,
        total_open: 0,
        total_closed: 0,
        total_without_tag: 0,
        avg_csat: null,
        avg_waiting_seconds: null,
        avg_duration_seconds: null,
      };

      const pivotData: PivotRow[] = pivotResult.data || [];
      const reportData = reportResult.data || [];

      if (reportData.length === 0) {
        toast.warning("Nenhum registro encontrado para exportar");
        return;
      }

      const lines: string[] = [];
      const BOM = "\uFEFF";

      // ===== SEÇÃO 1: KPIs =====
      lines.push("=== RESUMO EXECUTIVO ===");
      lines.push("");
      lines.push(`Período;${format(filters.startDate, "dd/MM/yyyy")} a ${format(filters.endDate, "dd/MM/yyyy")}`);
      lines.push("");
      lines.push("Indicador;Valor");
      lines.push(`Total de Conversas;${kpis.total_conversations}`);
      lines.push(`Conversas Abertas;${kpis.total_open}`);
      lines.push(`Conversas Fechadas;${kpis.total_closed}`);
      lines.push(`Sem Tag;${kpis.total_without_tag}`);
      lines.push(`CSAT Médio;${kpis.avg_csat ? kpis.avg_csat.toFixed(1).replace(".", ",") : "-"}`);
      lines.push(`Tempo Médio de Espera;${formatDuration(kpis.avg_waiting_seconds) || "-"}`);
      lines.push(`Duração Média;${formatDuration(kpis.avg_duration_seconds) || "-"}`);
      lines.push("");
      lines.push("");

      // ===== SEÇÃO 2: PIVOT =====
      if (pivotData.length > 0) {
        lines.push("=== MATRIZ DEPARTAMENTO x CATEGORIA ===");
        lines.push("");
        
        // Agrupar por departamento e categoria
        const deptMap = new Map<string, Map<string, number>>();
        const allCategories = new Set<string>();
        
        pivotData.forEach((row) => {
          if (!deptMap.has(row.department_name)) {
            deptMap.set(row.department_name, new Map());
          }
          deptMap.get(row.department_name)!.set(row.category, row.conversation_count);
          allCategories.add(row.category);
        });
        
        const categories = Array.from(allCategories).sort();
        
        // Header do pivot
        lines.push(["Departamento", ...categories].join(";"));
        
        // Linhas do pivot
        deptMap.forEach((catMap, deptName) => {
          const values = categories.map((cat) => catMap.get(cat) || 0);
          lines.push([escapeCSV(deptName), ...values].join(";"));
        });
        
        lines.push("");
        lines.push("");
      }

      // ===== SEÇÃO 3: DETALHADO =====
      lines.push("=== CONVERSAS DETALHADAS ===");
      lines.push("");

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

      lines.push(headers.join(";"));

      reportData.forEach((row: any) => {
        const rowValues = [
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
        ];
        lines.push(rowValues.join(";"));
      });

      const csvContent = BOM + lines.join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conversas_comerciais_${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalCount = reportData[0]?.total_count || reportData.length;
      if (totalCount > MAX_EXPORT_ROWS) {
        toast.success(`Exportados ${MAX_EXPORT_ROWS} de ${totalCount} registros (limite máximo)`);
      } else {
        toast.success(`Exportados ${reportData.length} registros com sucesso`);
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
