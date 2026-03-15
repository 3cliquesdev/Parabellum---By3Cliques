import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/components/ui/page-container";
import { ClipboardList, Clock } from "lucide-react";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";

const ReturnReasonsSettings = lazy(() => import("@/components/support/ReturnReasonsSettings"));
const SLASettings = lazy(() => import("@/pages/SLASettings"));

export default function ReturnsConfigSettings() {
  return (
    <PageContainer title="Conf. de Devoluções" subtitle="Gerencie motivos e SLA de devoluções">
      <Tabs defaultValue="reasons" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="reasons" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Motivos de Devolução
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-2">
            <Clock className="h-4 w-4" />
            SLA de Devoluções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reasons">
          <Suspense fallback={<PageLoadingSkeleton />}>
            <ReturnReasonsSettings embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="sla">
          <Suspense fallback={<PageLoadingSkeleton />}>
            <SLASettings embedded />
          </Suspense>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
