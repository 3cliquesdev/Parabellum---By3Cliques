import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Clock,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgentMetricsAggregate {
  agent_id: string;
  agent_name: string;
  total_conversations: number;
  suggestions_used: number;
  avg_resolution_time: number;
  avg_csat: number;
  kb_gaps_created: number;
  copilot_adoption_rate: number;
}

export default function AgentQualityDashboard() {
  const [period, setPeriod] = useState("7");

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['agent-quality-metrics', period],
    queryFn: async () => {
      const startDate = startOfDay(subDays(new Date(), parseInt(period)));
      
      // Fetch raw metrics
      const { data: rawMetrics, error } = await supabase
        .from('agent_quality_metrics')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Fetch profiles separately
      const agentIds = [...new Set(rawMetrics?.map(m => m.agent_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', agentIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      // Aggregate by agent
      const agentMap = new Map<string, AgentMetricsAggregate>();

      for (const metric of rawMetrics || []) {
        const agentId = metric.agent_id;
        
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            agent_id: agentId,
            agent_name: profileMap.get(agentId) || 'Agente',
            total_conversations: 0,
            suggestions_used: 0,
            avg_resolution_time: 0,
            avg_csat: 0,
            kb_gaps_created: 0,
            copilot_adoption_rate: 0,
          });
        }

        const agg = agentMap.get(agentId)!;
        agg.total_conversations++;
        agg.suggestions_used += metric.suggestions_used || 0;
        
        if (metric.resolution_time_seconds) {
          agg.avg_resolution_time += metric.resolution_time_seconds;
        }
        
        if (metric.csat_rating) {
          agg.avg_csat += metric.csat_rating;
        }
        
        if (metric.created_kb_gap) {
          agg.kb_gaps_created++;
        }
        
        if (metric.copilot_active) {
          agg.copilot_adoption_rate++;
        }
      }

      // Calculate averages
      const aggregated = Array.from(agentMap.values()).map(agg => ({
        ...agg,
        avg_resolution_time: agg.total_conversations > 0 
          ? Math.round(agg.avg_resolution_time / agg.total_conversations)
          : 0,
        avg_csat: agg.total_conversations > 0 
          ? Math.round((agg.avg_csat / agg.total_conversations) * 10) / 10
          : 0,
        copilot_adoption_rate: agg.total_conversations > 0
          ? Math.round((agg.copilot_adoption_rate / agg.total_conversations) * 100)
          : 0,
      }));

      return aggregated.sort((a, b) => b.copilot_adoption_rate - a.copilot_adoption_rate);
    },
  });

  // Calculate totals
  const totals = metrics?.reduce((acc, m) => ({
    conversations: acc.conversations + m.total_conversations,
    suggestionsUsed: acc.suggestionsUsed + m.suggestions_used,
    copilotActive: acc.copilotActive + (m.copilot_adoption_rate > 0 ? 1 : 0),
    kbGaps: acc.kbGaps + m.kb_gaps_created,
  }), { conversations: 0, suggestionsUsed: 0, copilotActive: 0, kbGaps: 0 }) || { conversations: 0, suggestionsUsed: 0, copilotActive: 0, kbGaps: 0 };

  const avgAdoptionRate = metrics?.length 
    ? Math.round(metrics.reduce((acc, m) => acc + m.copilot_adoption_rate, 0) / metrics.length)
    : 0;

  const avgResolutionTime = metrics?.length
    ? Math.round(metrics.reduce((acc, m) => acc + m.avg_resolution_time, 0) / metrics.length)
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}min`;
  };

  return (
    <Layout>
      <div className="container py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Qualidade Operacional
              </h1>
              <p className="text-muted-foreground text-sm">
                Métricas de desempenho e adoção do Copilot por agente
              </p>
            </div>
          </div>
          
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Adoção Copilot
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-primary">{avgAdoptionRate}%</div>
                  <Progress value={avgAdoptionRate} className="mt-2 h-2" />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tempo Médio Resolução
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{formatTime(avgResolutionTime)}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Sugestões Usadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totals.suggestionsUsed}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                KB Gaps → Artigos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totals.kbGaps}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agents Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Desempenho por Agente
            </CardTitle>
            <CardDescription>
              Métricas agregadas de qualidade e adoção do Copilot
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !metrics?.length ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sem dados no período</h3>
                <p className="text-muted-foreground">
                  As métricas de qualidade aparecerão conforme os agentes usarem o sistema.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead className="text-center">Conversas</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Bot className="h-4 w-4" />
                        Adoção Copilot
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Sugestões Usadas</TableHead>
                    <TableHead className="text-center">Tempo Médio</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4" />
                        CSAT
                      </div>
                    </TableHead>
                    <TableHead className="text-center">KB Gaps</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((agent) => (
                    <TableRow key={agent.agent_id}>
                      <TableCell className="font-medium">{agent.agent_name}</TableCell>
                      <TableCell className="text-center">{agent.total_conversations}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Progress 
                            value={agent.copilot_adoption_rate} 
                            className="w-16 h-2" 
                          />
                          <span className="text-sm font-medium w-10">
                            {agent.copilot_adoption_rate}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">
                          {agent.suggestions_used}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {formatTime(agent.avg_resolution_time)}
                      </TableCell>
                      <TableCell className="text-center">
                        {agent.avg_csat > 0 ? (
                          <span className="flex items-center justify-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            {agent.avg_csat.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {agent.kb_gaps_created > 0 ? (
                          <span className="text-amber-600">{agent.kb_gaps_created}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info banner */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span>
              <strong>Nota:</strong> Estas métricas são factuais e não representam avaliação de desempenho individual.
              Use para identificar oportunidades de treinamento e melhoria de processos.
            </span>
          </p>
        </div>
      </div>
    </Layout>
  );
}
