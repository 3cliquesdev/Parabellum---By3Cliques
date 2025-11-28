import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSLACompliance } from "@/hooks/useSLACompliance";
import { Clock, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SLAComplianceWidgetProps {
  startDate: Date;
  endDate: Date;
}

const COLORS = {
  on_time: 'hsl(142, 76%, 36%)', // Green
  overdue: 'hsl(0, 84%, 60%)', // Red
};

export function SLAComplianceWidget({ startDate, endDate }: SLAComplianceWidgetProps) {
  const { data: compliance, isLoading } = useSLACompliance(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            SLA Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: 'No Prazo', value: compliance?.on_time || 0, color: COLORS.on_time },
    { name: 'Atrasados', value: compliance?.overdue || 0, color: COLORS.overdue },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          SLA Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Compliance Rate Badge */}
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">
              {compliance?.compliance_rate.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">
              Taxa de Conformidade SLA
            </p>
          </div>

          {/* Donut Chart */}
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} tickets`, 'Quantidade']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: COLORS.on_time }}>
                {compliance?.on_time || 0}
              </div>
              <p className="text-xs text-muted-foreground">No Prazo</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: COLORS.overdue }}>
                {compliance?.overdue || 0}
              </div>
              <p className="text-xs text-muted-foreground">Atrasados</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
