import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useSaqueTelemetry, STEP_LABELS, OTP_RESULT_LABELS } from "@/hooks/useSaqueTelemetry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Banknote, ShieldCheck, ShieldX, TrendingUp, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

const STEP_COLORS: Record<string, string> = {
  intent_detected: "#6366f1",
  otp_sent: "#f59e0b",
  otp_validated: "#10b981",
  data_collected: "#3b82f6",
  ticket_created: "#22c55e",
  conversation_closed: "#8b5cf6",
  problem_reported: "#ef4444",
};

const OTP_RESULT_COLORS: Record<string, string> = {
  success: "#22c55e",
  code_sent: "#3b82f6",
  invalid_code: "#ef4444",
  expired: "#f59e0b",
  rate_limited: "#f97316",
  max_attempts: "#a855f7",
};

function StepBadge({ step }: { step: string }) {
  const colors: Record<string, string> = {
    intent_detected: "bg-indigo-100 text-indigo-800",
    otp_sent: "bg-yellow-100 text-yellow-800",
    otp_validated: "bg-emerald-100 text-emerald-800",
    data_collected: "bg-blue-100 text-blue-800",
    ticket_created: "bg-green-100 text-green-800",
    conversation_closed: "bg-purple-100 text-purple-800",
    problem_reported: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[step] ?? "bg-gray-100 text-gray-700"}`}>
      {STEP_LABELS[step] ?? step}
    </span>
  );
}

function OtpResultBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    success: "bg-green-100 text-green-800",
    code_sent: "bg-blue-100 text-blue-800",
    invalid_code: "bg-red-100 text-red-800",
    expired: "bg-yellow-100 text-yellow-800",
    rate_limited: "bg-orange-100 text-orange-800",
    max_attempts: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[result] ?? "bg-gray-100 text-gray-700"}`}>
      {OTP_RESULT_LABELS[result] ?? result}
    </span>
  );
}

export function SaqueTelemetryContent() {
  const [stepFilter, setStepFilter] = useState<string>("all");
  const [view, setView] = useState<"saque" | "otp">("saque");

  const {
    saqueData, otpData,
    isLoading, isError,
    refetch,
    kpis,
    stepBreakdown,
    otpResultBreakdown,
    hourlyData,
    lastUpdated,
  } = useSaqueTelemetry(24);

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

  if (isError) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Erro ao carregar dados de telemetria de saque.</AlertDescription>
      </Alert>
    );
  }

  const filteredSaques = stepFilter === "all" ? saqueData : saqueData.filter(s => s.step === stepFilter);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Telemetria de Saque & OTP</h2>
          <p className="text-sm text-muted-foreground">
            Últimas 24h{lastUpdated && ` · Atualizado ${formatDistanceToNow(lastUpdated, { locale: ptBR, addSuffix: true })}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-indigo-500" />
              <span className="text-xs text-muted-foreground">Saques Iniciados</span>
            </div>
            <div className="text-2xl font-bold">{kpis.totalSaques}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Tickets Criados</span>
            </div>
            <div className="text-2xl font-bold">{kpis.ticketsCriados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Taxa Conclusão</span>
            </div>
            <div className="text-2xl font-bold">{kpis.taxaConclusao}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">OTP Sucesso</span>
            </div>
            <div className="text-2xl font-bold">{kpis.otpSucesso}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldX className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">OTP Falhas</span>
            </div>
            <div className="text-2xl font-bold">{kpis.otpFalha}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Encerradas</span>
            </div>
            <div className="text-2xl font-bold">{kpis.conversasEncerradas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LineChart: saques por hora */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saques Iniciados por Hora (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} name="Saques" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* BarChart: resultado OTP */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resultado OTP</CardTitle>
          </CardHeader>
          <CardContent>
            {otpResultBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={otpResultBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="value" name="Qtd" radius={[0, 4, 4, 0]}>
                    {otpResultBreakdown.map((entry) => (
                      <Cell key={entry.result} fill={OTP_RESULT_COLORS[entry.result] ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funil de etapas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Funil de Etapas do Saque</CardTitle>
        </CardHeader>
        <CardContent>
          {stepBreakdown.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stepBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Eventos" radius={[4, 4, 0, 0]}>
                  {stepBreakdown.map((entry, idx) => {
                    const stepKey = Object.keys(STEP_LABELS).find(k => STEP_LABELS[k] === entry.name) ?? "";
                    return <Cell key={idx} fill={STEP_COLORS[stepKey] ?? "#94a3b8"} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* View toggle + Tabela */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Eventos Recentes</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={view === "saque" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("saque")}
              >
                Saque ({saqueData.length})
              </Button>
              <Button
                variant={view === "otp" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("otp")}
              >
                OTP ({otpData.length})
              </Button>
              {view === "saque" && (
                <Select value={stepFilter} onValueChange={setStepFilter}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etapas</SelectItem>
                    {Object.entries(STEP_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {view === "saque" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chave PIX</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Conversa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSaques.slice(0, 50).map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.created_at), { locale: ptBR, addSuffix: true })}
                    </TableCell>
                    <TableCell><StepBadge step={row.step} /></TableCell>
                    <TableCell>
                      <Badge variant={row.status === "success" ? "default" : row.status === "failure" ? "destructive" : "secondary"}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{row.pix_key_type ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.amount ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {row.conversation_id?.slice(0, 8) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSaques.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                      Nenhum evento encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Tentativa</TableHead>
                  <TableHead>Conversa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otpData.slice(0, 50).map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.created_at), { locale: ptBR, addSuffix: true })}
                    </TableCell>
                    <TableCell><OtpResultBadge result={row.result} /></TableCell>
                    <TableCell className="text-xs">{row.otp_reason ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.attempt_number}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {row.conversation_id?.slice(0, 8) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {otpData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                      Nenhum evento encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SaqueTelemetry() {
  return <Navigate to="/?tab=saque-telemetry" replace />;
}
