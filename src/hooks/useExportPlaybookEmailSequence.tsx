import * as XLSX from "xlsx";
import { toast } from "sonner";
import { EmailSequenceRow } from "./usePlaybookEmailSequenceReport";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getStatusDateTime(row: EmailSequenceRow): string | null {
  if (row.email_bounced_at) return row.email_bounced_at;
  if (row.email_clicked_at) return row.email_clicked_at;
  if (row.email_opened_at) return row.email_opened_at;
  if (row.email_sent_at) return row.email_sent_at;
  return null;
}

function getEmailStatus(row: EmailSequenceRow): string {
  if (row.email_bounced_at) return "Bounce";
  if (row.email_clicked_at) return "Clicado";
  if (row.email_opened_at) return "Aberto";
  if (row.email_status === "error") return "Erro";
  if (row.email_sent_at) return "Enviado";
  return "Pendente";
}

function getPositionLabels(grouped: Map<string, { meta: EmailSequenceRow; emails: EmailSequenceRow[] }>, maxEmails: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < maxEmails; i++) {
    const freq = new Map<string, number>();
    for (const g of grouped.values()) {
      const name = g.emails[i]?.email_template_name;
      if (name) freq.set(name, (freq.get(name) || 0) + 1);
    }
    let best = `Email ${i + 1}`;
    let bestCount = 0;
    for (const [name, count] of freq) {
      if (count > bestCount) { best = name; bestCount = count; }
    }
    labels.push(best);
  }
  return labels;
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

      // Detect template names per position
      const posLabels = getPositionLabels(grouped, maxEmails);

      // Build rows
      const excelRows: Record<string, string>[] = [];
      for (const g of grouped.values()) {
        const row: Record<string, string> = {
          "Cliente": g.meta.contact_name,
          "Email": g.meta.contact_email || "",
          "Playbook": g.meta.playbook_name,
          "Data Venda": fmtDateTime(g.meta.sale_date),
        };

        for (let i = 0; i < maxEmails; i++) {
          const label = posLabels[i];
          const email = g.emails[i];
          row[`${label}`] = email ? fmtDateTime(email.email_sent_at) : "";
          row[`${label} - Status`] = email ? getEmailStatus(email) : "";
          row[`${label} - Status data e hora`] = email ? fmtDateTime(getStatusDateTime(email)) : "";
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
