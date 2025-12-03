import { useEmailFunnelData } from "@/hooks/useEmailTrackingEvents";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

export function EmailFunnelChart() {
  const { data: funnelData, isLoading } = useEmailFunnelData();

  if (isLoading) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!funnelData || funnelData.every(d => d.value === 0)) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        Nenhum dado de email disponível
      </div>
    );
  }

  const colors = [
    'hsl(221.2 83.2% 53.3%)', // primary blue
    'hsl(142 76% 36%)',       // green
    'hsl(38 92% 50%)',        // amber
    'hsl(280 84% 50%)',       // purple
  ];

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={funnelData} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis type="number" />
          <YAxis 
            type="category" 
            dataKey="stage" 
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value: number) => [value, 'Emails']}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Bar 
            dataKey="value" 
            radius={[0, 4, 4, 0]}
            maxBarSize={40}
          >
            {funnelData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
