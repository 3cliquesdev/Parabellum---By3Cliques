import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";
import { AIInsightsWidget } from "@/components/widgets/AIInsightsWidget";
import { YoYComparisonWidget } from "@/components/widgets/YoYComparisonWidget";
import { ChannelQualityWidget } from "@/components/widgets/ChannelQualityWidget";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BarChart3, TrendingUp, Sparkles } from "lucide-react";

export default function Analytics() {
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  // Validação de permissões - apenas admin e manager podem acessar Analytics
  useEffect(() => {
    if (!roleLoading && role !== null && role === 'sales_rep') {
      navigate('/dashboard');
    }
  }, [roleLoading, role, navigate]);

  if (roleLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (role === 'sales_rep') {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                Analytics 2.0
                <Sparkles className="h-6 w-6 text-primary" />
              </h1>
              <p className="text-muted-foreground">
                Análises profundas e Business Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* AI Insights - Full Width Destaque */}
        <div className="w-full">
          <AIInsightsWidget />
        </div>

        {/* YoY Comparison + Channel Quality - 2 Columns */}
        <div className="grid gap-6 md:grid-cols-2">
          <YoYComparisonWidget />
          <ChannelQualityWidget />
        </div>

        {/* Conversion Rate Trend - Full Width */}
        <div className="w-full">
          <ConversionRateWidget />
        </div>
      </div>
    </div>
  );
}
