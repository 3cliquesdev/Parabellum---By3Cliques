import { useState, useMemo, useEffect, useCallback } from "react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-container";
import { useAIDecisionTelemetry, REASON_LABELS } from "@/hooks/useAIDecisionTelemetry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, AlertTriangle, ArrowRightLeft, ShieldAlert, Activity, RefreshCw, Check, ArrowUpDown, Copy } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const REASON_COLORS: Record<string, string> = {
  zero_confidence_cautious: "#ef4444",
  strict_rag_handoff: "#f59e0b",
  confidence_flow_advance: "#f97316",
  fallback_phrase_detected: "#eab308",
  restriction_violation: "#a855f7",
  anti_loop_max_fallbacks: "#6b7280",
};

function getReasonLabel(eventType: string): string {
  const short = eventType.replace("ai_decision_", "");
  const key = short.startsWith("restriction_violation") ? "restriction_violation" : short;
  return REASON_LABELS[key] || short;
}

function getReasonColor(eventType: string): string {
  const short = eventType.replace("ai_decision_", "");
  const key = short.startsWith("restriction_violation") ? "restriction_violation" : short;
  return REASON_COLORS[key] || "#6b7280";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success("ID copiado!");
  });
}

export default function AITelemetry() {
  const { events, isLoading, isError, refetch, kpis, typeBreakdown, hourlyData, lastUpdated } = useAIDecisionTelemetry(24);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [, setTick] = useState(0);

  // Force re-render every 30s to update relative timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = useMemo(() => {
    let filtered = events.slice(0, 50);
    if (typeFilter !== "all") {
      filtered = filtered.filter(e => e.event_type.includes(typeFilter));
    }
    if (sortAsc) {
      filtered = [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return filtered;
  }, [events, typeFilter, sortAsc]);

  const totalForPercent = useMemo(() => typeBreakdown.reduce((s, t) => s + t.value, 0), [typeBreakdown]);

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Telemetria AI" description="Monitoramento de decisões em tempo real" />
        <PageContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-3">
              Erro ao carregar telemetria. Tente novamente.
              <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
            </AlertDescription>
          </Alert>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Telemetria AI"
        description="Monitoramento de decisões em tempo real"
      >
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Atualizado há {formatDistanceToNow(lastUpdated, { locale: ptBR })}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>
      </PageHeader>

      <PageContent>
        <div className="space-y-6">
          {/* KPI Cards */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Decisões */}
              <Card className="border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Decisões (24h)</p>
                      <p className="text-3xl font-bold text-foreground">{kpis.total}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Activity className="h-5 w-5 text-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Handoffs */}
              <Card className="border-amber-400/20 bg-amber-400/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Handoffs para Humano</p>
                      <p className="text-3xl font-bold text-amber-400">{kpis.handoffs}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-amber-400/10 flex items-center justify-center">
                      <ArrowRightLeft className="h-5 w-5 text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Fallbacks */}
              <Card className="border-red-400/20 bg-red-400/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Fallbacks Detectados</p>
                      <p className="text-3xl font-bold text-red-400">{kpis.fallbacks}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-red-400/10 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Violações */}
              <Card className="border-orange-400/20 bg-orange-400/5">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Violações</p>
                      <p className="text-3xl font-bold text-orange-400">{kpis.violations}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-orange-400/10 flex items-center justify-center">
                      <ShieldAlert className="h-5 w-5 text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts Row — 60/40 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Decisões por hora (últimas 24h)</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : hourlyData.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                    Nenhum evento nas últimas 24h
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [value, "Eventos"]}
                      />
                      <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Distribuição por tipo</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : typeBreakdown.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                    Nenhum evento nas últimas 24h
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={typeBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        tickFormatter={(v) => REASON_LABELS[v] || v}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [value, "Eventos"]}
                        labelFormatter={(label) => REASON_LABELS[label] || label}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {typeBreakdown.map((entry, i) => (
                          <Cell key={i} fill={REASON_COLORS[entry.name] || "#6b7280"} />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="right"
                          formatter={(v: number) => totalForPercent > 0 ? `${Math.round((v / totalForPercent) * 100)}%` : ""}
                          style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar + Events Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Eventos Recentes
                  <Badge variant="secondary" className="ml-1">Últimos 50</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="strict_rag_handoff">RAG Estrito</SelectItem>
                      <SelectItem value="zero_confidence">Confiança Zero</SelectItem>
                      <SelectItem value="confidence_flow">Handoff por Confiança</SelectItem>
                      <SelectItem value="anti_loop">Anti-Loop</SelectItem>
                      <SelectItem value="fallback_phrase">Frase de Fallback</SelectItem>
                      <SelectItem value="restriction_violation">Violação de Restrição</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSortAsc(prev => !prev)}
                  >
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    {sortAsc ? "Mais antigos" : "Mais recentes"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-8 flex-1" />
                      <Skeleton className="h-8 flex-1" />
                      <Skeleton className="h-8 flex-1" />
                    </div>
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-base font-medium text-foreground">Nenhuma decisão registrada</p>
                  <p className="text-sm text-muted-foreground mt-1">Os eventos aparecerão aqui assim que o sistema processar mensagens.</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conversa</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Artigos</TableHead>
                        <TableHead>Contexto</TableHead>
                        <TableHead>Fallback</TableHead>
                        <TableHead>Tempo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((evt) => {
                        const json = evt.output_json as any;
                        const scoreColor = evt.score == null
                          ? "text-muted-foreground"
                          : evt.score > 0.7
                            ? "text-green-400"
                            : evt.score >= 0.3
                              ? "text-yellow-400"
                              : "text-red-400";

                        return (
                          <TableRow key={evt.id} className="hover:bg-muted/50">
                            <TableCell>
                              <button
                                onClick={() => copyToClipboard(evt.entity_id)}
                                className="font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                                title={evt.entity_id}
                              >
                                …{evt.entity_id?.slice(-8)}
                                <Copy className="h-3 w-3 opacity-40" />
                              </button>
                            </TableCell>
                            <TableCell>
                              <span
                                className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                                style={{
                                  borderColor: getReasonColor(evt.event_type) + "30",
                                  backgroundColor: getReasonColor(evt.event_type) + "15",
                                  color: getReasonColor(evt.event_type),
                                }}
                              >
                                {getReasonLabel(evt.event_type)}
                              </span>
                            </TableCell>
                            <TableCell className={`text-xs font-mono ${scoreColor}`}>
                              {evt.score != null ? evt.score.toFixed(2) : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {json?.articles_found != null ? json.articles_found : "—"}
                            </TableCell>
                            <TableCell>
                              {json?.hasFlowContext ? (
                                <span className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-400/10 text-indigo-400 px-2 py-0.5 text-xs font-medium">
                                  Com fluxo
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {json?.fallback_used ? (
                                <Check className="h-4 w-4 text-green-400" />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true, locale: ptBR })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </PageContainer>
  );
}
