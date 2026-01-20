import { useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

export interface ExcelReportData {
  periodo: { inicio: Date; fim: Date };
  resumo: {
    dealsCreados: number;
    dealsGanhos: number;
    dealsAbertos: number;
    dealsPerdidos: number;
    taxaConversao: string;
  };
  receita: {
    bruta: number;
    liquida: number;
  };
  clientes: {
    total: number;
    novos: number;
    recorrentes: number;
  };
  categorias?: Array<{ nome: string; deals: number; receita: number }>;
  produtos?: Array<{ nome: string; vendas: number; bruto: number; liquido: number }>;
  vendedores?: Array<{ nome: string; deals: number; receita: number }>;
}

interface ExportExcelOptions {
  filename?: string;
  title?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

export function useExportExcel() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = useCallback(
    async (data: ExcelReportData, options: ExportExcelOptions = {}) => {
      const { filename = "relatorio_vendas", title = "Relatório de Vendas e Assinaturas" } = options;
      setIsExporting(true);

      try {
        const workbook = XLSX.utils.book_new();
        const periodoInicio = format(data.periodo.inicio, "dd/MM/yyyy", { locale: ptBR });
        const periodoFim = format(data.periodo.fim, "dd/MM/yyyy", { locale: ptBR });
        const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

        // Aba 1: Resumo Geral
        const resumoData = [
          [title],
          [`Período: ${periodoInicio} a ${periodoFim}`],
          [`Gerado em: ${geradoEm}`],
          [],
          ["RESUMO DO FUNIL", ""],
          ["Métrica", "Valor"],
          ["Deals Criados", data.resumo.dealsCreados],
          ["Deals Ganhos", data.resumo.dealsGanhos],
          ["Deals Abertos", data.resumo.dealsAbertos],
          ["Deals Perdidos", data.resumo.dealsPerdidos],
          ["Taxa de Conversão", data.resumo.taxaConversao],
          [],
          ["RECEITA", ""],
          ["Métrica", "Valor"],
          ["Receita Bruta", data.receita.bruta],
          ["Receita Bruta (Formatado)", formatCurrency(data.receita.bruta)],
          ["Receita Líquida", data.receita.liquida],
          ["Receita Líquida (Formatado)", formatCurrency(data.receita.liquida)],
          [],
          ["CLIENTES", ""],
          ["Métrica", "Valor"],
          ["Total de Vendas", data.clientes.total],
          ["Clientes Novos", data.clientes.novos],
          ["Clientes Recorrentes", data.clientes.recorrentes],
        ];
        const resumoSheet = XLSX.utils.aoa_to_sheet(resumoData);
        resumoSheet["!cols"] = [{ wch: 30 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(workbook, resumoSheet, "Resumo");

        // Aba 2: Por Categoria (se houver dados)
        if (data.categorias && data.categorias.length > 0) {
          const catData = [
            ["Categoria", "Deals", "Receita", "Receita (Formatado)"],
            ...data.categorias.map(c => [c.nome, c.deals, c.receita, formatCurrency(c.receita)])
          ];
          const catSheet = XLSX.utils.aoa_to_sheet(catData);
          catSheet["!cols"] = [{ wch: 35 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];
          XLSX.utils.book_append_sheet(workbook, catSheet, "Por Categoria");
        }

        // Aba 3: Por Produto (se houver dados)
        if (data.produtos && data.produtos.length > 0) {
          const prodData = [
            ["Produto", "Vendas", "Valor Bruto", "Bruto (Formatado)", "Valor Líquido", "Líquido (Formatado)"],
            ...data.produtos.map(p => [
              p.nome, 
              p.vendas, 
              p.bruto, 
              formatCurrency(p.bruto),
              p.liquido, 
              formatCurrency(p.liquido)
            ])
          ];
          const prodSheet = XLSX.utils.aoa_to_sheet(prodData);
          prodSheet["!cols"] = [{ wch: 45 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
          XLSX.utils.book_append_sheet(workbook, prodSheet, "Por Produto");
        }

        // Aba 4: Por Vendedor (se houver dados)
        if (data.vendedores && data.vendedores.length > 0) {
          const vendData = [
            ["Vendedor", "Deals", "Receita", "Receita (Formatado)"],
            ...data.vendedores.map(v => [v.nome, v.deals, v.receita, formatCurrency(v.receita)])
          ];
          const vendSheet = XLSX.utils.aoa_to_sheet(vendData);
          vendSheet["!cols"] = [{ wch: 35 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];
          XLSX.utils.book_append_sheet(workbook, vendSheet, "Por Vendedor");
        }

        // Gerar e baixar arquivo
        const fileName = `${filename}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
        XLSX.writeFile(workbook, fileName);
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return { exportToExcel, isExporting };
}
