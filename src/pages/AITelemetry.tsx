import { useState, useMemo } from "react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-container";
import { useAIDecisionTelemetry } from "@/hooks/useAIDecisionTelemetry";
import { KPIScorecard } from "@/components/analytics/subscriptions/KPIScorecard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, AlertTriangle, ArrowRightLeft, ShieldAlert, Activity, RefreshCw, Check, ArrowUpDown, Copy } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const REASON_COLORS: Record<string, string> = {
  zero_confidence_cautious: "hsl(0, 72%, 51%)",        // red
  strict_rag_handoff: "hsl(38, 92%, 50%)",              // amber
  confidence_flow_advance: "hsl(25, 95%, 53%)",         // orange
  fallback_phrase_detected: "hsl(48, 96%, 53%)",        // yellow
  restriction_violation: "hsl(270, 70%, 55%)",           // purple
  anti_loop_max_fallbacks: "hsl(220, 9%, 46%)",          // gray
};

const REASON_LABELS: Record<string, string> = {
  strict_rag_handoff: "RAG Handoff",
  zero_confidence_cautious: "Zero Confidence",
  confidence_flow_advance: "Flow Advance",
  anti_loop_max_fallbacks: "Anti-Loop",
  fallback_phrase_detected: "Fallback Detectado",
  restriction_violation: "Violação Restrição",
};

function getReasonLabel(eventType: string): string {
  const short = eventType.replace("ai_decision_", "");
  if (short.startsWith("restriction_violation")) return "Violação: " + short.replace("restriction_violation_", "");
  return REASON_LABELS[short] || short;
}

function getReasonBadgeClass(eventType: string): string {
  const short = eventType.replace("ai_decision_", "");
  if (short.includes("handoff")) return "border-warning/30 bg-warning/10 text-warning";
  if (short.includes("zero_confidence") || short.includes("fallback_phrase")) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (short.includes("restriction_violation") || short.includes("anti_loop")) return "border-orange-500/30 bg-orange-500/10 text-orange-500";
  if (short.includes("confidence_flow")) return "border-warning/30 bg-warning/10 text-warning";
  return "border-muted-foreground/30 bg-muted text-muted-foreground";
}

function getScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score > 0.7) return "text-success";
  if (score >= 0.3) return "text-warning";
  return "text-destructive";
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success("ID copiado!");
  });
}

export default function AITelemetry() {
  const { events, isLoading, refetch, kpis, typeBreakdown, hourlyData, lastUpdated } = useAIDecisionTelemetry(24);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortAsc, setSortAsc] = useState(false);

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

  return (
    <PageContainer>
      <PageHeader
        title="Telemetria AI"
        description="Monitoramento de decisões em tempo real"
      >
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Atualizado {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: ptBR })}
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
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPIScorecard
              title="Decisões (24h)"
              value={kpis.total}
              icon={Activity}
              iconColor="text-primary"
              isLoading={isLoading}
            />
            <KPIScorecard
              title="Handoffs para Humano"
              value={kpis.handoffs}
              subtitle="RAG + Flow Advance"
              icon={ArrowRightLeft}
              iconColor="text-warning"
              isLoading={isLoading}
            />
            <KPIScorecard
              title="Fallbacks Detectados"
              value={kpis.fallbacks}
              subtitle="Zero confidence + frases genéricas"
              icon={AlertTriangle}
              iconColor="text-destructive"
              isLoading={isLoading}
            />
            <KPIScorecard
              title="Violações"
              value={kpis.violations}
              subtitle="Restrições + anti-loop"
              icon={ShieldAlert}
              iconColor="text-orange-500"
              isLoading={isLoading}
            />
          </div>

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
                      />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
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
                        width={110}
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
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {typeBreakdown.map((entry, i) => (
                          <Cell key={i} fill={REASON_COLORS[entry.name] || "hsl(var(--muted-foreground))"} />
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

          {/* Events Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Eventos Recentes
                  <Badge variant="secondary" className="ml-1">Últimos 50</Badge>
                </CardTitle>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="strict_rag_handoff">RAG Handoff</SelectItem>
                    <SelectItem value="zero_confidence">Zero Confidence</SelectItem>
                    <SelectItem value="confidence_flow">Flow Advance</SelectItem>
                    <SelectItem value="anti_loop">Anti-Loop</SelectItem>
                    <SelectItem value="fallback_phrase">Fallback Detectado</SelectItem>
                    <SelectItem value="restriction_violation">Violação Restrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <EmptyState
                  icon={<Brain className="h-12 w-12" />}
                  title="Nenhuma decisão registrada ainda"
                  description="Os eventos aparecerão aqui assim que o sistema processar mensagens."
                  className="py-16"
                />
              ) : (
                <div className="overflow-auto max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conversa</TableHead>
                        <TableHead>Tipo de Decisão</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Contexto</TableHead>
                        <TableHead>Artigos</TableHead>
                        <TableHead>Fallback</TableHead>
                        <TableHead>
                          <button
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                            onClick={() => setSortAsc(prev => !prev)}
                          >
                            Tempo
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((evt) => {
                        const json = evt.output_json as any;
                        return (
                          <TableRow key={evt.id} className="hover:bg-muted/50">
                            <TableCell>
                              <button
                                onClick={() => copyToClipboard(evt.entity_id)}
                                className="font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                title="Clique para copiar"
                              >
                                {evt.entity_id?.slice(0, 8)}…
                                <Copy className="h-3 w-3 opacity-40" />
                              </button>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getReasonBadgeClass(evt.event_type)}`}>
                                {getReasonLabel(evt.event_type)}
                              </span>
                            </TableCell>
                            <TableCell className={`text-xs font-mono ${getScoreColor(evt.score)}`}>
                              {evt.score != null ? evt.score.toFixed(2) : "—"}
                            </TableCell>
                            <TableCell>
                              {json?.hasFlowContext ? (
                                <Badge variant="outline" className="text-xs">Com fluxo</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {json?.articles_found ?? "—"}
                            </TableCell>
                            <TableCell>
                              {json?.fallback_used ? (
                                <Check className="h-4 w-4 text-warning" />
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
