import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

const PAGE_SIZE = 1000;

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getEmailStatus(row: {
  bounced_at: string | null;
  replied_at: string | null;
  clicked_at: string | null;
  opened_at: string | null;
  sent_at: string | null;
  status: string | null;
}): string {
  if (row.bounced_at) return "Bounce";
  if (row.replied_at) return "Respondido";
  if (row.clicked_at) return "Clicado";
  if (row.opened_at) return "Aberto";
  if (row.status === "error") return "Erro";
  if (row.sent_at) return "Enviado";
  return "Pendente";
}

interface ExportFilters {
  dateRange?: DateRange;
  templateId?: string;
}

export function useExportEmailSendsReport() {
  const exportToExcel = async (filters: ExportFilters) => {
    const toastId = toast.loading("Buscando dados de envios...");

    try {
      // Fetch all templates (V1 + V2) for name lookup
      const [{ data: templatesV1 }, { data: templatesV2 }] = await Promise.all([
        supabase.from("email_templates").select("id, name"),
        supabase.from("email_templates_v2").select("id, name"),
      ]);

      const templateMap = new Map<string, string>();
      templatesV1?.forEach((t) => templateMap.set(t.id, t.name));
      templatesV2?.forEach((t) => templateMap.set(t.id, t.name));

      // Paginated fetch of email_sends with contact join
      let allRows: any[] = [];
      let offset = 0;

      while (true) {
        let query = supabase
          .from("email_sends")
          .select("id, template_id, recipient_email, subject, sent_at, status, clicked_at, opened_at, bounced_at, replied_at, contact_id, contacts(first_name, last_name)")
          .order("sent_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (filters.templateId) {
          query = query.eq("template_id", filters.templateId);
        }
        if (filters.dateRange?.from) {
          query = query.gte("sent_at", filters.dateRange.from.toISOString());
        }
        if (filters.dateRange?.to) {
          const endOfDay = new Date(filters.dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte("sent_at", endOfDay.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = data || [];
        if (rows.length === 0) break;

        allRows = allRows.concat(rows);
        toast.loading(`Buscando dados... ${allRows.length} registros`, { id: toastId });

        if (rows.length < PAGE_SIZE) break;
        if (allRows.length >= 50000) break;
        offset += PAGE_SIZE;
      }

      if (allRows.length === 0) {
        toast.warning("Nenhum envio encontrado com os filtros selecionados", { id: toastId });
        return;
      }

      // Build Excel rows
      const excelRows = allRows.map((row: any) => {
        const contact = row.contacts;
        const contactName = contact
          ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
          : "";

        return {
          "Template": templateMap.get(row.template_id) || "—",
          "Contato": contactName,
          "Email": row.recipient_email,
          "Assunto": row.subject,
          "Data/Hora Envio": fmtDateTime(row.sent_at),
          "Status": getEmailStatus(row),
          "Respondido": fmtDateTime(row.replied_at),
          "Clicado": fmtDateTime(row.clicked_at),
          "Aberto": fmtDateTime(row.opened_at),
          "Bounce": fmtDateTime(row.bounced_at),
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Envios de Email");

      // Auto-width
      const headers = Object.keys(excelRows[0]);
      ws["!cols"] = headers.map((key) => ({
        wch: Math.max(key.length, ...excelRows.map((r) => String(r[key as keyof typeof r] || "").length)) + 2,
      }));

      XLSX.writeFile(wb, `relatorio-envios-email-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${excelRows.length} envios exportados com sucesso!`, { id: toastId });
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar: " + err.message, { id: toastId });
    }
  };

  return { exportToExcel };
}
