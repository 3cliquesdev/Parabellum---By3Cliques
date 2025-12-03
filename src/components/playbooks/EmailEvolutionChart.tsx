import { useEmailEvolutionData } from "@/hooks/useEmailTrackingEvents";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function EmailEvolutionChart() {
  const { data: evolutionData, isLoading } = useEmailEvolutionData(7);

  if (isLoading) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!evolutionData || evolutionData.length === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        Nenhum dado disponível nos últimos 7 dias
      </div>
    );
  }

  const formattedData = evolutionData.map(d => ({
    ...d,
    date: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
  }));

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={formattedData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))', 
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="sent" 
            name="Enviados"
            stroke="hsl(221.2 83.2% 53.3%)" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="delivered" 
            name="Entregues"
            stroke="hsl(142 76% 36%)" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="opened" 
            name="Abertos"
            stroke="hsl(38 92% 50%)" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="clicked" 
            name="Clicados"
            stroke="hsl(280 84% 50%)" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
