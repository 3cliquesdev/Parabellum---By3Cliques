import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { fetchAllRpcPages } from "@/lib/fetchAllRpcPages";

export interface ExportFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  agentId?: string;
  status?: string;
  channel?: string;
  search?: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
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
      const [kpisResult, pivotResult, reportData] = await Promise.all([
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
        fetchAllRpcPages({
          rpcName: "get_commercial_conversations_report",
          params: {
            p_start: filters.startDate.toISOString(),
            p_end: filters.endDate.toISOString(),
            p_department_id: filters.departmentId || null,
            p_agent_id: filters.agentId || null,
            p_status: filters.status || null,
            p_channel: filters.channel || null,
            p_search: filters.search || null,
          },
        }),
      ]);

      if (kpisResult.error) {
        console.error("[Export] Erro ao buscar KPIs:", kpisResult.error);
        throw new Error(`Erro ao buscar KPIs: ${kpisResult.error.message || 'Erro desconhecido'}`);
      }

      if (pivotResult.error) {
        console.error("[Export] Erro ao buscar Pivot:", pivotResult.error);
        throw new Error(`Erro ao buscar Pivot: ${pivotResult.error.message || 'Erro desconhecido'}`);
      }

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

      if (reportData.length === 0) {
        toast.warning("Nenhum registro encontrado para exportar");
        return;
      }

      // Criar workbook
      const wb = XLSX.utils.book_new();

      // ===== ABA 1: RESUMO =====
      const resumoData = [
        ["RESUMO EXECUTIVO"],
        [],
        ["Período", `${format(filters.startDate, "dd/MM/yyyy")} a ${format(filters.endDate, "dd/MM/yyyy")}`],
        [],
        ["Indicador", "Valor"],
        ["Total de Conversas", kpis.total_conversations],
        ["Conversas Abertas", kpis.total_open],
        ["Conversas Fechadas", kpis.total_closed],
        ["Sem Tag", kpis.total_without_tag],
        ["CSAT Médio", kpis.avg_csat ? Number(kpis.avg_csat.toFixed(1)) : "-"],
        ["Tempo Médio de Espera", formatDuration(kpis.avg_waiting_seconds) || "-"],
        ["Duração Média", formatDuration(kpis.avg_duration_seconds) || "-"],
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      wsResumo["!cols"] = [{ wch: 25 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      // ===== ABA 2: PIVOT =====
      if (pivotData.length > 0) {
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
        
        const pivotSheetData: (string | number)[][] = [];
        pivotSheetData.push(["Departamento", ...categories, "Total"]);
        
        deptMap.forEach((catMap, deptName) => {
          const values = categories.map((cat) => catMap.get(cat) || 0);
          const total = values.reduce((a, b) => a + b, 0);
          pivotSheetData.push([deptName, ...values, total]);
        });

        const totalsRow: (string | number)[] = ["TOTAL"];
        categories.forEach((cat) => {
          let catTotal = 0;
          deptMap.forEach((catMap) => {
            catTotal += catMap.get(cat) || 0;
          });
          totalsRow.push(catTotal);
        });
        totalsRow.push(totalsRow.slice(1).reduce((a: number, b) => a + (b as number), 0));
        pivotSheetData.push(totalsRow);

        const wsPivot = XLSX.utils.aoa_to_sheet(pivotSheetData);
        wsPivot["!cols"] = [{ wch: 25 }, ...categories.map(() => ({ wch: 15 })), { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsPivot, "Pivot");
      } else {
        const wsPivot = XLSX.utils.aoa_to_sheet([["Sem dados de pivot para o período selecionado"]]);
        XLSX.utils.book_append_sheet(wb, wsPivot, "Pivot");
      }

      // ===== ABA 3: DETALHADO =====
      const headers = [
        "ID Curto", "ID Conversa", "Status", "Nome Contato", "Email",
        "Telefone", "Organização", "Criado em", "Fechado em",
        "Tempo de Espera", "Duração", "Agente Responsável", "Participantes",
        "Departamento", "Total Interações", "Origem", "CSAT", "Comentário CSAT",
        "Ticket ID", "Modo IA", "Tags", "Tags Automáticas", "Última Tag Conversa",
        "Primeira Mensagem", "Tempo Espera pós Atribuição",
      ];

      const detailData: (string | number)[][] = [headers];

      reportData.forEach((row: any) => {
        detailData.push([
          row.short_id || "",
          row.conversation_id || "",
          row.status || "",
          row.contact_name || "",
          row.contact_email || "",
          row.contact_phone || "",
          row.contact_organization || "",
          row.created_at ? format(new Date(row.created_at), "dd/MM/yyyy HH:mm") : "",
          row.closed_at ? format(new Date(row.closed_at), "dd/MM/yyyy HH:mm") : "",
          formatDuration(row.waiting_time_seconds),
          formatDuration(row.duration_seconds),
          row.assigned_agent_name || "",
          Array.isArray(row.participants) ? row.participants.join(", ") : (row.participants || ""),
          row.department_name || "",
          row.interactions_count || 0,
          row.origin || "",
          row.csat_score || "",
          row.csat_comment || "",
          row.ticket_id || "",
          row.bot_flow || "",
          Array.isArray(row.tags_all) ? row.tags_all.join(", ") : (row.tags_all || ""),
          Array.isArray(row.tags_auto) ? row.tags_auto.join(", ") : (row.tags_auto || ""),
          row.last_conversation_tag || "",
          row.first_customer_message || "",
          formatDuration(row.waiting_after_assignment_seconds),
        ]);
      });

      const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
      wsDetail["!cols"] = headers.map((h) => ({ wch: Math.max(h.length, 12) }));
      XLSX.utils.book_append_sheet(wb, wsDetail, "Detalhado");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conversas_comerciais_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${reportData.length.toLocaleString("pt-BR")} registros exportados com sucesso`);
    } catch (error: any) {
      console.error("[Export] Erro ao exportar:", error);
      
      const errorMessage = error?.message 
        || error?.details 
        || (typeof error === 'string' ? error : 'Erro desconhecido');
      
      toast.error("Erro ao exportar relatório", {
        description: errorMessage.length > 150 
          ? errorMessage.substring(0, 150) + "..." 
          : errorMessage,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCSV, isExporting };
}
