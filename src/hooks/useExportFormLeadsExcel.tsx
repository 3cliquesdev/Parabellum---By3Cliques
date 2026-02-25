import * as XLSX from "xlsx";
import { format } from "date-fns";
import { DetailedRow } from "./useFormLeadsConversionReport";

interface DailyRow {
  date: string;
  leads: number;
  won: number;
  lost: number;
  conversionRate: number;
  revenue: number;
}

const statusLabels: Record<string, string> = {
  won: "Ganho",
  lost: "Perdido",
  open: "Aberto",
};

export function useExportFormLeadsExcel() {
  const exportToExcel = (
    dailyData: DailyRow[],
    kpis: { totalLeads: number; totalWon: number; totalLost: number; conversionRate: number; totalRevenue: number },
    detailedData?: DetailedRow[]
  ) => {
    // Sheet 1: Resumo Diário
    const rows = dailyData.map((d) => ({
      Data: d.date,
      "Leads Criados": d.leads,
      "Deals Ganhos": d.won,
      "Deals Perdidos": d.lost,
      "Taxa Conversão (%)": d.conversionRate,
      "Receita (R$)": d.revenue,
    }));

    rows.push({
      Data: "TOTAL",
      "Leads Criados": kpis.totalLeads,
      "Deals Ganhos": kpis.totalWon,
      "Deals Perdidos": kpis.totalLost,
      "Taxa Conversão (%)": kpis.conversionRate,
      "Receita (R$)": kpis.totalRevenue,
    });

    const ws1 = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Resumo Diário");

    ws1["!cols"] = [
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
    ];

    // Sheet 2: Detalhado (sempre presente)
    const detailedRows = (detailedData ?? []).map((d) => ({
      "Data Preenchimento": d.submissionDate ? format(new Date(d.submissionDate), "dd/MM/yyyy HH:mm") : "—",
      Contato: d.contactName,
      Formulário: d.formName,
      "Status Deal": d.dealStatus ? (statusLabels[d.dealStatus] ?? d.dealStatus) : "Sem deal",
      "Data Fechamento": d.closingDate ? format(new Date(d.closingDate), "dd/MM/yyyy HH:mm") : "—",
      "Valor (R$)": d.dealValue ?? 0,
    }));

    const ws2 = detailedRows.length > 0
      ? XLSX.utils.json_to_sheet(detailedRows)
      : XLSX.utils.aoa_to_sheet([["Data Preenchimento", "Contato", "Formulário", "Status Deal", "Data Fechamento", "Valor (R$)"]]);
    ws2["!cols"] = [
      { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, "Detalhado");

    const fileName = `leads-vs-conversao-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return { exportToExcel };
}
