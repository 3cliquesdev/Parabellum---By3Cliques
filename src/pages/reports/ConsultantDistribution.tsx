import { useState } from "react";
import { useConsultantDistributionReport } from "@/hooks/useConsultantDistributionReport";
import { ConsultantDistributionStats } from "@/components/reports/ConsultantDistributionStats";
import { ClientsByConsultantTable } from "@/components/reports/ClientsByConsultantTable";
import { LinkedClientsTable } from "@/components/reports/LinkedClientsTable";
import { UnassignedClientsAlert } from "@/components/reports/UnassignedClientsAlert";
import { ClientDistributionImport } from "@/components/reports/ClientDistributionImport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ConsultantDistribution() {
  const [importOpen, setImportOpen] = useState(false);

  const {
    stats,
    isLoadingStats,
    byConsultant,
    isLoadingByConsultant,
    linkedClients,
    isLoadingLinkedClients,
    unlinkedClients,
    unlinkedTotal,
    isLoadingUnlinked,
    distributeBatch,
    isDistributing,
    updateClientConsultants,
    isUpdatingConsultants,
  } = useConsultantDistributionReport();

  const exportFullCSV = () => {
    const headers = ["client_id", "client_name", "email", "phone", "consultant_id", "consultant_name", "status", "created_at"];
    const rows = linkedClients.map((c) => [
      c.id,
      `${c.first_name} ${c.last_name}`,
      c.email || "",
      c.phone || "",
      c.consultant_id,
      c.consultant_name,
      c.status,
      format(new Date(c.created_at), "yyyy-MM-dd", { locale: ptBR }),
    ]);

    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `distribuicao-clientes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Distribuição de Clientes</h1>
          <p className="text-muted-foreground">
            Relatório de vinculação de clientes aos consultores
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportFullCSV} disabled={isLoadingLinkedClients}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Planilha
          </Button>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Planilha
          </Button>
        </div>
      </div>

      <ConsultantDistributionStats stats={stats} isLoading={isLoadingStats} />

      {unlinkedTotal > 0 && (
        <UnassignedClientsAlert
          clients={unlinkedClients}
          total={unlinkedTotal}
          isLoading={isLoadingUnlinked}
          onDistribute={distributeBatch}
          isDistributing={isDistributing}
        />
      )}

      <Tabs defaultValue="by-consultant" className="space-y-4">
        <TabsList>
          <TabsTrigger value="by-consultant">Por Consultor</TabsTrigger>
          <TabsTrigger value="clients-list">Lista de Clientes</TabsTrigger>
        </TabsList>
        <TabsContent value="by-consultant">
          <ClientsByConsultantTable data={byConsultant} isLoading={isLoadingByConsultant} />
        </TabsContent>
        <TabsContent value="clients-list">
          <LinkedClientsTable
            clients={linkedClients}
            consultants={byConsultant}
            isLoading={isLoadingLinkedClients}
          />
        </TabsContent>
      </Tabs>

      <ClientDistributionImport
        open={importOpen}
        onOpenChange={setImportOpen}
        consultants={byConsultant}
        onImport={updateClientConsultants}
        isImporting={isUpdatingConsultants}
      />
    </div>
  );
}
