import { useSearchParams } from "react-router-dom";
import { FinancialStatusWidget } from "@/components/widgets/FinancialStatusWidget";
import { LTVWidget } from "@/components/widgets/LTVWidget";
import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";
import { RecentActionsWidget } from "@/components/widgets/RecentActionsWidget";

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "overview";

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

  // Visualização Completa (overview)
  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      {/* Widget 1: Status Financeiro - Topo */}
      <div className="w-full">
        <FinancialStatusWidget />
      </div>

      {/* Grid de 2 colunas para Widgets 2 e 3 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
        <div className="min-h-[400px]">
          <LTVWidget />
        </div>
        <div className="min-h-[400px]">
          <ConversionRateWidget />
        </div>
      </div>

      {/* Widget 4: Últimas Ações - Rodapé */}
      <div className="w-full">
        <RecentActionsWidget />
      </div>
    </div>
  );
}
