import { useConsultantDistributionReport } from "@/hooks/useConsultantDistributionReport";
import { ConsultantDistributionStats } from "@/components/reports/ConsultantDistributionStats";
import { ClientsByConsultantTable } from "@/components/reports/ClientsByConsultantTable";
import { LinkedClientsTable } from "@/components/reports/LinkedClientsTable";
import { UnassignedClientsAlert } from "@/components/reports/UnassignedClientsAlert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ConsultantDistribution() {
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
  } = useConsultantDistributionReport();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Distribuição de Clientes</h1>
        <p className="text-muted-foreground">
          Relatório de vinculação de clientes aos consultores
        </p>
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
    </div>
  );
}
