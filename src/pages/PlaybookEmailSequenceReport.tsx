import React, { useState, useEffect } from "react";
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

  // Detect template names per position for preview headers
  const maxPreviewCols = Math.max(3, ...Array.from(grouped.values()).map(g => g.emails.length));
  const positionLabels: string[] = [];
  for (let i = 0; i < maxPreviewCols; i++) {
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
    positionLabels.push(best);
  }
  const displayCols = data.length > 0 ? Math.min(maxPreviewCols, Math.max(3, maxPreviewCols)) : 3;

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
                     {positionLabels.slice(0, displayCols).map((label, i) => (
                        <React.Fragment key={i}>
                          <TableHead className="bg-primary/5 text-xs">{label}</TableHead>
                          <TableHead className="bg-primary/5 text-xs">{label} - Status</TableHead>
                          <TableHead className="bg-primary/5 text-xs">{label} - Status data/hora</TableHead>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((g) => (
                      <TableRow key={g.meta.execution_id}>
                        <TableCell className="font-medium">{g.meta.contact_name}</TableCell>
                        <TableCell>{g.meta.playbook_name}</TableCell>
                        <TableCell>{fmtDateTime(g.meta.sale_date)}</TableCell>
                        {positionLabels.slice(0, displayCols).map((_, i) => {
                          const email = g.emails[i];
                          if (!email) return (
                            <React.Fragment key={i}>
                              <TableCell className="text-muted-foreground">—</TableCell>
                              <TableCell className="text-muted-foreground">—</TableCell>
                              <TableCell className="text-muted-foreground">—</TableCell>
                            </React.Fragment>
                          );
                          const status = getEmailStatus(email);
                          return (
                            <React.Fragment key={i}>
                              <TableCell className="text-xs">{fmtDateTime(email.email_sent_at)}</TableCell>
                              <TableCell className={`text-xs ${getStatusColor(status)}`}>{status}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{fmtDateTime(getStatusDateTime(email))}</TableCell>
                            </React.Fragment>
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
