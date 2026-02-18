import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, Search } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { usePlaybookEmailSequenceReport, EmailSequenceRow } from "@/hooks/usePlaybookEmailSequenceReport";
import { useExportPlaybookEmailSequence } from "@/hooks/useExportPlaybookEmailSequence";

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

function getStatusColor(status: string): string {
  switch (status) {
    case "Clicado": return "text-green-600";
    case "Aberto": return "text-blue-600";
    case "Enviado": return "text-muted-foreground";
    case "Bounce": return "text-red-600";
    case "Erro": return "text-red-600";
    default: return "text-muted-foreground";
  }
}

export default function PlaybookEmailSequenceReport() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [playbookId, setPlaybookId] = useState("all");
  const [playbooks, setPlaybooks] = useState<{ id: string; name: string }[]>([]);
  const { data, loading, fetchReport } = usePlaybookEmailSequenceReport();
  const { exportToExcel } = useExportPlaybookEmailSequence();

  useEffect(() => {
    supabase.from("onboarding_playbooks").select("id, name").order("name").then(({ data }) => {
      if (data) setPlaybooks(data);
    });
  }, []);

  const handleSearch = () => {
    fetchReport({ dateRange, playbookId });
  };

  // Group data for preview
  const grouped = new Map<string, { meta: EmailSequenceRow; emails: EmailSequenceRow[] }>();
  for (const row of data) {
    if (!grouped.has(row.execution_id)) {
      grouped.set(row.execution_id, { meta: row, emails: [] });
    }
    if (row.email_subject || row.email_sent_at) {
      grouped.get(row.execution_id)!.emails.push(row);
    }
  }
  const previewRows = Array.from(grouped.values()).slice(0, 10);

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            Sequência de E-mails por Venda
          </h1>
          <p className="text-muted-foreground">Exportação com todas as etapas de e-mail por execução de playbook</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Período</label>
              <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
            </div>
            <div className="space-y-1 min-w-[200px]">
              <label className="text-sm font-medium">Playbook</label>
              <Select value={playbookId} onValueChange={setPlaybookId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {playbooks.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button
              variant="outline"
              onClick={() => exportToExcel(data)}
              disabled={loading || !data.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {loading ? (
        <Card>
          <CardContent className="py-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      ) : data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              📋 Preview ({grouped.size} execuções, {data.filter(d => d.email_subject).length} e-mails)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Playbook</TableHead>
                      <TableHead>Data Venda</TableHead>
                      {[1, 2, 3].map((n) => (
                        <TableHead key={n} className="bg-primary/5">
                          Email {n}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((g) => (
                      <TableRow key={g.meta.execution_id}>
                        <TableCell className="font-medium">{g.meta.contact_name}</TableCell>
                        <TableCell>{g.meta.playbook_name}</TableCell>
                        <TableCell>{fmtDate(g.meta.sale_date)} {fmtTime(g.meta.sale_date)}</TableCell>
                        {[0, 1, 2].map((i) => {
                          const email = g.emails[i];
                          if (!email) return <TableCell key={i} className="text-muted-foreground">—</TableCell>;
                          const status = getEmailStatus(email);
                          return (
                            <TableCell key={i}>
                              <div className="text-xs space-y-0.5">
                                <div className="font-medium truncate max-w-[180px]">{email.email_subject}</div>
                                <div className="text-muted-foreground">{fmtDate(email.email_sent_at)} {fmtTime(email.email_sent_at)}</div>
                                <div className={getStatusColor(status)}>{status}</div>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
            {grouped.size > 10 && (
              <p className="text-sm text-muted-foreground mt-3">
                Mostrando 10 de {grouped.size} execuções. Exporte o Excel para ver todos.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
