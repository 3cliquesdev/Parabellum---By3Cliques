import * as XLSX from "xlsx";
import { toast } from "sonner";
import { EmailSequenceRow } from "./usePlaybookEmailSequenceReport";

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

function getEmailStatus(row: EmailSequenceRow): string {
  if (row.email_bounced_at) return "Bounce";
  if (row.email_clicked_at) return "Clicado";
  if (row.email_opened_at) return "Aberto";
  if (row.email_status === "error") return "Erro";
  if (row.email_sent_at) return "Enviado";
  return "Pendente";
}

export function useExportPlaybookEmailSequence() {
  const exportToExcel = (rows: EmailSequenceRow[]) => {
    if (!rows.length) {
      toast.warning("Nenhum dado para exportar");
      return;
    }

    toast.info("Gerando Excel...");

    try {
      // Group by execution_id
      const grouped = new Map<string, { meta: EmailSequenceRow; emails: EmailSequenceRow[] }>();
      for (const row of rows) {
        if (!grouped.has(row.execution_id)) {
          grouped.set(row.execution_id, { meta: row, emails: [] });
        }
        if (row.email_subject || row.email_sent_at) {
          grouped.get(row.execution_id)!.emails.push(row);
        }
      }

      // Find max emails
      let maxEmails = 0;
      for (const g of grouped.values()) {
        if (g.emails.length > maxEmails) maxEmails = g.emails.length;
      }

      // Build rows
      const excelRows: Record<string, string>[] = [];
      for (const g of grouped.values()) {
        const row: Record<string, string> = {
          "Cliente": g.meta.contact_name,
          "Email": g.meta.contact_email || "",
          "Playbook": g.meta.playbook_name,
          "Data Venda": fmtDate(g.meta.sale_date),
          "Hora Venda": fmtTime(g.meta.sale_date),
        };

        for (let i = 0; i < maxEmails; i++) {
          const n = i + 1;
          const email = g.emails[i];
          row[`Email ${n} - Título`] = email?.email_subject || "";
          row[`Email ${n} - Data`] = email ? fmtDate(email.email_sent_at) : "";
          row[`Email ${n} - Hora`] = email ? fmtTime(email.email_sent_at) : "";
          row[`Email ${n} - Status`] = email ? getEmailStatus(email) : "";
        }

        excelRows.push(row);
      }

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sequência E-mails");

      // Auto-width
      const headers = Object.keys(excelRows[0]);
      ws["!cols"] = headers.map((key) => ({
        wch: Math.max(key.length, ...excelRows.map((r) => String(r[key] || "").length)) + 2,
      }));

      XLSX.writeFile(wb, `relatorio-sequencia-emails-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${excelRows.length} execuções exportadas com sucesso!`);
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar: " + err.message);
    }
  };

  return { exportToExcel };
}
