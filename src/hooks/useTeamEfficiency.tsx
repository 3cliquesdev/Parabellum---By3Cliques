import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AgentEfficiency {
  agent_name: string;
  avg_resolution_minutes: number;
  tickets_resolved: number;
}

export function useTeamEfficiency(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['team-efficiency', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<AgentEfficiency[]> => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          created_at,
          resolved_at,
          assigned_to,
          profiles:assigned_to (
            full_name
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('resolved_at', 'is', null);

      if (error) throw error;

      // Group by agent
      const agentMap = new Map<string, { total_minutes: number; count: number }>();

      data?.forEach((ticket: any) => {
        if (!ticket.profiles?.full_name) return;

        const agent_name = ticket.profiles.full_name;
        const created = new Date(ticket.created_at);
        const resolved = new Date(ticket.resolved_at);
        const minutes = (resolved.getTime() - created.getTime()) / (1000 * 60);

        if (!agentMap.has(agent_name)) {
          agentMap.set(agent_name, { total_minutes: 0, count: 0 });
        }

        const stats = agentMap.get(agent_name)!;
        stats.total_minutes += minutes;
        stats.count += 1;
      });

      // Convert to array and calculate averages
      const result: AgentEfficiency[] = Array.from(agentMap.entries())
        .map(([agent_name, stats]) => ({
          agent_name,
          avg_resolution_minutes: stats.total_minutes / stats.count,
          tickets_resolved: stats.count
        }))
        .sort((a, b) => a.avg_resolution_minutes - b.avg_resolution_minutes)
        .slice(0, 10); // Top 10 agents

      return result;
    },
  });
}
