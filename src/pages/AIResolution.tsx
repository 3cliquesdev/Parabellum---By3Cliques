import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAIResolutionMetrics } from "@/hooks/useAIResolutionMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, Users, ArrowRightLeft, HelpCircle, RefreshCw, AlertTriangle, TrendingUp } from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  zero_confidence_cautious: "Confiança Zero",
  strict_rag_handoff: "RAG Sem Resposta",
  confidence_flow_advance: "Baixa Confiança",
  fallback_phrase_detected: "Frase de Fallback",
  restriction_violation: "Violação de Restrição",
  anti_loop_max_fallbacks: "Anti-Loop",
  handoff: "Handoff Geral",
};

export function AIResolutionContent() {
  const [daysBack, setDaysBack] = useState(30);

  const {
    metrics,
    dailyData,
    handoffReasons,
    donutData,
    isLoading,
    isError,
    refetch,
    lastUpdated,
  } = useAIResolutionMetrics(daysBack);

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

  if (isError || !metrics) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Erro ao carregar métricas de resolução. Rode a migration SQL primeiro.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Resolução por IA</h2>
          <p className="text-sm text-muted-foreground">
            Últimos {daysBack} dias
            {lastUpdated && ` · Atualizado ${formatDistanceToNow(lastUpdated, { locale: ptBR, addSuffix: true })}`}
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
          <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-muted-foreground">Total Encerradas</span>
            </div>
            <div className="text-2xl font-bold">{metrics.total_closed}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">IA Resolveu</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{metrics.ai_resolved}</div>
            <div className="text-xs text-green-600 font-medium">{metrics.ai_resolution_rate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Humano/Misto</span>
            </div>
            <div className="text-2xl font-bold">{metrics.human_resolved + metrics.mixed_resolved}</div>
            <div className="text-xs text-blue-500 font-medium">{metrics.human_rate}%</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRightLeft className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Handoff</span>
            </div>
            <div className="text-2xl font-bold text-yellow-700">{metrics.human_handoff}</div>
            <div className="text-xs text-yellow-600 font-medium">{metrics.handoff_rate}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-muted-foreground">Não classificado</span>
            </div>
            <div className="text-2xl font-bold text-slate-500">{metrics.unclassified}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos linha + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tendência Diária de Resolução</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ai_resolved" stroke="#22c55e" strokeWidth={2} dot={false} name="IA" />
                  <Line type="monotone" dataKey="human" stroke="#3b82f6" strokeWidth={2} dot={false} name="Humano" />
                  <Line type="monotone" dataKey="handoff" stroke="#f59e0b" strokeWidth={2} dot={false} name="Handoff" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribuição Geral</CardTitle>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {donutData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        <span>{d.name}</span>
                      </div>
                      <span className="font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BarChart: razões de handoff — onde melhorar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Por Que a IA Não Resolveu — Motivos de Handoff</CardTitle>
        </CardHeader>
        <CardContent>
          {handoffReasons.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sem dados de ai_events no período</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={handoffReasons.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  tick={{ fontSize: 10 }}
                  width={140}
                  tickFormatter={v => REASON_LABELS[v] ?? v}
                />
                <Tooltip labelFormatter={v => REASON_LABELS[v as string] ?? v} />
                <Bar dataKey="count" name="Ocorrências" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AIResolution() {
  return <Navigate to="/?tab=ai-resolution" replace />;
}
