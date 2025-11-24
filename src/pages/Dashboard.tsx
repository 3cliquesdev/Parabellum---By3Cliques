import { useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Widgets Admin/Manager
import { FinancialStatusWidget } from "@/components/widgets/FinancialStatusWidget";
import { LTVWidget } from "@/components/widgets/LTVWidget";
import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";
import { RecentActionsWidget } from "@/components/widgets/RecentActionsWidget";

// Widgets Sales Rep
import { MySalesWidget } from "@/components/widgets/MySalesWidget";
import { MyTasksWidget } from "@/components/widgets/MyTasksWidget";
import { MyLeadsWidget } from "@/components/widgets/MyLeadsWidget";
import { MyPerformanceWidget } from "@/components/widgets/MyPerformanceWidget";

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "overview";
  const { role, loading } = useUserRole();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // VENDEDOR: Dashboard Pessoal
  if (role && (role as string) === "sales_rep") {
    return (
      <div className="min-h-screen p-6 flex flex-col gap-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground">Meu Dashboard</h1>
          <p className="text-muted-foreground">Suas métricas e atividades pessoais</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <MySalesWidget userId={user?.id} />
          <MyLeadsWidget userId={user?.id} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <MyTasksWidget userId={user?.id} />
          <MyPerformanceWidget userId={user?.id} />
        </div>
      </div>
    );
  }

  // Visualização Financeira - apenas widgets financeiros
  if (view === "financial") {
    return (
      <div className="min-h-screen p-6 flex flex-col gap-6">
        <div className="w-full">
          <FinancialStatusWidget />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
          <div className="min-h-[400px]">
            <LTVWidget />
          </div>
          <div className="min-h-[400px]">
            <ConversionRateWidget />
          </div>
        </div>
      </div>
    );
  }

  // ADMIN/MANAGER: Dashboard Geral (Atual)
  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Geral</h1>
        <p className="text-muted-foreground">Visão geral da empresa</p>
      </div>

      {/* Visualização Financeira */}
      {view === "financial" && (
        <>
          <div className="w-full">
            <FinancialStatusWidget />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
            <div className="min-h-[400px]">
              <LTVWidget />
            </div>
            <div className="min-h-[400px]">
              <ConversionRateWidget />
            </div>
          </div>
        </>
      )}

      {/* Visualização Completa (overview) */}
      {view === "overview" && (
        <>
          <div className="w-full">
            <FinancialStatusWidget />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
            <div className="min-h-[400px]">
              <LTVWidget />
            </div>
            <div className="min-h-[400px]">
              <ConversionRateWidget />
            </div>
          </div>

          <div className="w-full">
            <RecentActionsWidget />
          </div>
        </>
      )}
    </div>
  );
}
