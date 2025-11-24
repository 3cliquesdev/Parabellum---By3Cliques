import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";

export default function Analytics() {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics 2.0</h1>
          <p className="text-muted-foreground">
            Análises profundas e Business Intelligence
          </p>
        </div>
        
        {/* FASE 12B: Conversion Rate Trend Widget */}
        <div className="grid gap-6">
          <ConversionRateWidget />
        </div>

        {/* Placeholder para próximas subfases */}
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg text-muted-foreground">
            🚧 Mais widgets serão adicionados nas próximas subfases
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            FASE 12C: AI Insights | FASE 12D: YoY Comparison | FASE 12E: Channel Quality
          </p>
        </div>
      </div>
    </div>
  );
}
