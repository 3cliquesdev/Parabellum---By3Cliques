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
  ofertas?: Array<{ produto: string; oferta: string; vendas: number; bruto: number; liquido: number }>;
  timeComercial?: Array<{ nome: string; deals: number; receita: number }>;
  // Nova: Lista detalhada de clientes com emails
  clientesDetalhado?: Array<{
    email: string;
    nome: string;
    produto: string;
    oferta: string;
    valorBruto: number;
    valorLiquido: number;
    data: string;
    canal: string;
    // Novas colunas de inteligência
    eVenda: string;        // "Sim" | "Não"
    eAssinatura: string;   // "Sim" | "Não"
    eReembolso: string;    // "Sim" | "Não"
    categoria: string;     // "Venda" | "Assinatura" | "Reembolso"
    statusAssinatura: string; // "Ativa" | "Cancelada" | "Encerrada" | "Pago" | etc.
  }>;
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

        // Aba 1: Resumo Geral - Formato tabela horizontal
        const resumoData: (string | number)[][] = [
          [title],
          [`Período: ${periodoInicio} a ${periodoFim} | Gerado em: ${geradoEm}`],
          [],
          // Headers do Funil
          ["Deals Criados", "Deals Ganhos", "Deals Abertos", "Deals Perdidos", "Taxa Conversão"],
          [data.resumo.dealsCreados, data.resumo.dealsGanhos, data.resumo.dealsAbertos, data.resumo.dealsPerdidos, data.resumo.taxaConversao],
          [],
          // Headers de Receita
          ["Receita Bruta", "Receita Bruta (R$)", "Receita Líquida", "Receita Líquida (R$)"],
          [data.receita.bruta, formatCurrency(data.receita.bruta), data.receita.liquida, formatCurrency(data.receita.liquida)],
          [],
          // Headers de Clientes
          ["Total Vendas", "Clientes Novos", "Clientes Recorrentes"],
          [data.clientes.total, data.clientes.novos, data.clientes.recorrentes],
        ];

        // Top 5 Produtos no Resumo
        if (data.produtos && data.produtos.length > 0) {
          resumoData.push(
            [],
            ["TOP 5 PRODUTOS"],
            ["Produto", "Vendas", "Receita Bruta"],
            ...data.produtos.slice(0, 5).map(p => [p.nome, p.vendas, formatCurrency(p.bruto)])
          );
        }

        // Top 5 Ofertas no Resumo
        if (data.ofertas && data.ofertas.length > 0) {
          resumoData.push(
            [],
            ["TOP 5 OFERTAS"],
            ["Oferta", "Vendas", "Receita Bruta"],
            ...data.ofertas.slice(0, 5).map(o => [o.oferta, o.vendas, formatCurrency(o.bruto)])
          );
        }

        // Top 5 Time Comercial no Resumo
        if (data.timeComercial && data.timeComercial.length > 0) {
          resumoData.push(
            [],
            ["TOP 5 TIME COMERCIAL"],
            ["Vendedor", "Deals", "Receita"],
            ...data.timeComercial.slice(0, 5).map(t => [t.nome, t.deals, formatCurrency(t.receita)])
          );
        }

        const resumoSheet = XLSX.utils.aoa_to_sheet(resumoData);
        resumoSheet["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 18 }];
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

        // Aba 4: Por Oferta (se houver dados)
        if (data.ofertas && data.ofertas.length > 0) {
          const ofertaData = [
            ["Produto", "Oferta", "Vendas", "Valor Bruto", "Bruto (Formatado)", "Valor Líquido", "Líquido (Formatado)"],
            ...data.ofertas.map(o => [
              o.produto,
              o.oferta,
              o.vendas,
              o.bruto,
              formatCurrency(o.bruto),
              o.liquido,
              formatCurrency(o.liquido)
            ])
          ];
          const ofertaSheet = XLSX.utils.aoa_to_sheet(ofertaData);
          ofertaSheet["!cols"] = [{ wch: 35 }, { wch: 45 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
          XLSX.utils.book_append_sheet(workbook, ofertaSheet, "Por Oferta");
        }

        // Aba 5: Time Comercial (se houver dados)
        if (data.timeComercial && data.timeComercial.length > 0) {
          const timeData = [
            ["Membro do Time", "Deals Fechados", "Receita", "Receita (Formatado)"],
            ...data.timeComercial.map(t => [t.nome, t.deals, t.receita, formatCurrency(t.receita)])
          ];
          const timeSheet = XLSX.utils.aoa_to_sheet(timeData);
          timeSheet["!cols"] = [{ wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 20 }];
          XLSX.utils.book_append_sheet(workbook, timeSheet, "Time Comercial");
        }

        // Aba 6: Clientes Detalhado (com emails e colunas de inteligência!)
        if (data.clientesDetalhado && data.clientesDetalhado.length > 0) {
          const clientesData = [
            ["Email", "Nome", "Produto", "Oferta", "Valor Bruto", "Bruto (R$)", "Valor Líquido", "Líquido (R$)", "Data", "Canal", "É Venda", "É Assinatura", "É Reembolso", "Categoria", "Status Assinatura"],
            ...data.clientesDetalhado.map(c => [
              c.email,
              c.nome,
              c.produto,
              c.oferta,
              c.valorBruto,
              formatCurrency(c.valorBruto),
              c.valorLiquido,
              formatCurrency(c.valorLiquido),
              c.data,
              c.canal,
              c.eVenda || '',
              c.eAssinatura || '',
              c.eReembolso || '',
              c.categoria || '',
              c.statusAssinatura || ''
            ])
          ];
          const clientesSheet = XLSX.utils.aoa_to_sheet(clientesData);
          clientesSheet["!cols"] = [
            { wch: 35 }, // Email
            { wch: 25 }, // Nome
            { wch: 30 }, // Produto
            { wch: 35 }, // Oferta
            { wch: 12 }, // Valor Bruto
            { wch: 15 }, // Bruto (R$)
            { wch: 12 }, // Valor Líquido
            { wch: 15 }, // Líquido (R$)
            { wch: 12 }, // Data
            { wch: 12 }, // Canal
            { wch: 10 }, // É Venda
            { wch: 12 }, // É Assinatura
            { wch: 12 }, // É Reembolso
            { wch: 14 }, // Categoria
            { wch: 18 }, // Status Assinatura
          ];
          XLSX.utils.book_append_sheet(workbook, clientesSheet, "Clientes Detalhado");
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
