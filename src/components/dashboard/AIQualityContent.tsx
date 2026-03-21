import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts";
import { Star, TrendingUp, AlertTriangle, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  if (pct >= 80) return <Badge className="bg-green-100 text-green-700 border-green-200">{pct}%</Badge>;
  if (pct >= 60) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">{pct}%</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200">{pct}%</Badge>;
}

export function AIQualityContent() {
  const [daysBack, setDaysBack] = useState(30);

  const startDate = subDays(new Date(), daysBack).toISOString();

  const { data: logs = [], isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["ai-quality-logs", daysBack],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_quality_logs")
        .select("id, confidence_score, action_taken, handoff_reason, created_at, conversation_id, articles_count")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Métricas agregadas
  const resolvedByAI = logs.filter(l => l.action_taken === "conversation_resolved_by_ai");
  const avgScore = resolvedByAI.length
    ? resolvedByAI.reduce((s, l) => s + (l.confidence_score ?? 0), 0) / resolvedByAI.length
    : null;

  const scoreAbove8 = resolvedByAI.filter(l => (l.confidence_score ?? 0) >= 0.8).length;
  const scoreBelow6 = resolvedByAI.filter(l => (l.confidence_score ?? 0) < 0.6).length;
  const handoffLogs = logs.filter(l => l.action_taken === "handoff");

  // Tendência diária
  const dailyMap: Record<string, { day: string; avg: number; count: number; sum: number }> = {};
  resolvedByAI.forEach(l => {
    const day = format(new Date(l.created_at), "dd/MM");
    if (!dailyMap[day]) dailyMap[day] = { day, avg: 0, count: 0, sum: 0 };
    dailyMap[day].sum += l.confidence_score ?? 0;
    dailyMap[day].count++;
  });
  const dailyTrend = Object.values(dailyMap)
    .map(d => ({ day: d.day, nota: Math.round((d.sum / d.count) * 10 * 10) / 10 }))
    .slice(-20);

  // Distribuição de scores
  const scoreRanges = [
    { label: "Excelente (8-10)", count: resolvedByAI.filter(l => (l.confidence_score ?? 0) >= 0.8).length, color: "#22c55e" },
    { label: "Bom (6-8)", count: resolvedByAI.filter(l => (l.confidence_score ?? 0) >= 0.6 && (l.confidence_score ?? 0) < 0.8).length, color: "#3b82f6" },
    { label: "Regular (4-6)", count: resolvedByAI.filter(l => (l.confidence_score ?? 0) >= 0.4 && (l.confidence_score ?? 0) < 0.6).length, color: "#f59e0b" },
    { label: "Ruim (0-4)", count: resolvedByAI.filter(l => (l.confidence_score ?? 0) < 0.4).length, color: "#ef4444" },
  ].filter(r => r.count > 0);

  // Últimos logs de baixa qualidade (para review)
  const lowQualityLogs = resolvedByAI.filter(l => (l.confidence_score ?? 1) < 0.6).slice(0, 10);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Qualidade das Respostas</h2>
          <p className="text-sm text-muted-foreground">
            Últimos {daysBack} dias · {resolvedByAI.length} atendimentos avaliados
            {dataUpdatedAt ? ` · Atualizado ${formatDistanceToNow(new Date(dataUpdatedAt), { locale: ptBR, addSuffix: true })}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(daysBack)} onValueChange={v => setDaysBack(Number(v))}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Nota Média</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {avgScore !== null ? (avgScore * 10).toFixed(1) : "—"}
              <span className="text-sm font-normal text-muted-foreground">/10</span>
            </div>
            {avgScore !== null && <ScoreBadge score={avgScore} />}
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsUp className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Nota ≥ 8</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{scoreAbove8}</div>
            <div className="text-xs text-green-600 font-medium">
              {resolvedByAI.length ? Math.round((scoreAbove8 / resolvedByAI.length) * 100) : 0}% excelentes
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Nota &lt; 6</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{scoreBelow6}</div>
            <div className="text-xs text-red-500 font-medium">precisam revisão</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-muted-foreground">Total Avaliados</span>
            </div>
            <div className="text-2xl font-bold">{resolvedByAI.length}</div>
            <div className="text-xs text-muted-foreground">{logs.length} logs totais</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tendência de Qualidade (Nota Média Diária)</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyTrend.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => [`${v}/10`, "Nota média"]} />
                  <Line type="monotone" dataKey="nota" stroke="#3b82f6" strokeWidth={2} dot={false} name="Nota" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribuição de Notas</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreRanges.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scoreRanges} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 9 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Atendimentos" radius={[0, 4, 4, 0]}>
                    {scoreRanges.map((r, i) => (
                      <Cell key={i} fill={r.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Atendimentos abaixo do padrão */}
      {lowQualityLogs.length > 0 && (
        <Card className="border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Atendimentos Abaixo do Padrão — Para Revisão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowQualityLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs border rounded-lg p-2 bg-red-50/30">
                  <div className="flex items-center gap-3">
                    <ScoreBadge score={log.confidence_score ?? 0} />
                    <span className="text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM HH:mm")}
                    </span>
                    <span className="font-mono text-slate-500 truncate max-w-[180px]">
                      conv. {log.conversation_id?.slice(0, 8)}...
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {log.articles_count} artigos usados
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {resolvedByAI.length === 0 && (
        <div className="text-center text-muted-foreground text-sm py-12">
          Ainda não há atendimentos avaliados no período. Os dados aparecem após conversas encerradas pela IA.
        </div>
      )}
    </div>
  );
}
