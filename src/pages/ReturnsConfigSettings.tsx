import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Clock } from "lucide-react";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";

const ReturnReasonsSettings = lazy(() => import("@/components/support/ReturnReasonsSettings"));
const SLASettings = lazy(() => import("@/pages/SLASettings"));

export default function ReturnsConfigSettings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conf. de Devoluções</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie motivos e SLA de devoluções</p>
      </div>

      <Tabs defaultValue="reasons" className="w-full">
        <TabsList className="mb-4">
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
            <ReturnReasonsSettings />
          </Suspense>
        </TabsContent>

        <TabsContent value="sla">
          <Suspense fallback={<PageLoadingSkeleton />}>
            <SLASettings />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
