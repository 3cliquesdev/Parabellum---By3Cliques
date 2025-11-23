import { FinancialStatusWidget } from "@/components/widgets/FinancialStatusWidget";
import { GuestChartWidget } from "@/components/widgets/GuestChartWidget";
import { OccupancyDonutWidget } from "@/components/widgets/OccupancyDonutWidget";
import { RecentActionsWidget } from "@/components/widgets/RecentActionsWidget";

export default function Dashboard() {
  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      {/* Widget 1: Status Financeiro - Topo */}
      <div className="w-full">
        <FinancialStatusWidget />
      </div>

      {/* Grid de 2 colunas para Widgets 2 e 3 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
        <div className="min-h-[400px]">
          <GuestChartWidget />
        </div>
        <div className="min-h-[400px]">
          <OccupancyDonutWidget />
        </div>
      </div>

      {/* Widget 4: Últimas Ações - Rodapé */}
      <div className="w-full">
        <RecentActionsWidget />
      </div>
    </div>
  );
}
