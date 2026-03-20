import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";

export interface SaqueLog {
  id: string;
  conversation_id: string | null;
  contact_id: string | null;
  ticket_id: string | null;
  step: string;
  status: string;
  pix_key_type: string | null;
  amount: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OtpAuditLog {
  id: string;
  conversation_id: string | null;
  contact_id: string | null;
  otp_reason: string | null;
  result: string;
  attempt_number: number;
  channel: string;
  created_at: string;
}

export const STEP_LABELS: Record<string, string> = {
  intent_detected: "Intent Detectado",
  otp_sent: "OTP Enviado",
  otp_validated: "OTP Validado",
  data_collected: "Dados Coletados",
  ticket_created: "Ticket Criado",
  conversation_closed: "Conversa Encerrada",
  problem_reported: "Problema Reportado",
};

export const OTP_RESULT_LABELS: Record<string, string> = {
  code_sent: "Código Enviado",
  success: "Sucesso",
  invalid_code: "Código Inválido",
  expired: "Expirado",
  rate_limited: "Rate Limit",
  max_attempts: "Máx. Tentativas",
};

export function useSaqueTelemetry(hoursBack = 24) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - hoursBack);
    return d.toISOString();
  }, [hoursBack]);

  const { data: saqueData = [], isLoading: saqueLoading, isError: saqueError, refetch: refetchSaque } = useQuery({
    queryKey: ["saque-operation-logs", hoursBack],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saque_operation_logs")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setLastUpdated(new Date());
      return (data ?? []) as SaqueLog[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: otpData = [], isLoading: otpLoading, isError: otpError, refetch: refetchOtp } = useQuery({
    queryKey: ["otp-verification-audit", hoursBack],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("otp_verification_audit")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as OtpAuditLog[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const kpis = useMemo(() => {
    const totalSaques = saqueData.filter(s => s.step === "intent_detected").length;
    const ticketsCriados = saqueData.filter(s => s.step === "ticket_created" && s.status === "success").length;
    const conversasEncerradas = saqueData.filter(s => s.step === "conversation_closed" && s.status === "success").length;
    const otpSucesso = otpData.filter(o => o.result === "success").length;
    const otpFalha = otpData.filter(o => ["invalid_code", "expired", "max_attempts", "rate_limited"].includes(o.result)).length;
    const taxaConclusao = totalSaques > 0 ? Math.round((ticketsCriados / totalSaques) * 100) : 0;
    return { totalSaques, ticketsCriados, conversasEncerradas, otpSucesso, otpFalha, taxaConclusao };
  }, [saqueData, otpData]);

  const stepBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    saqueData.forEach(s => { map[s.step] = (map[s.step] || 0) + 1; });
    const order = ["intent_detected", "otp_sent", "otp_validated", "data_collected", "ticket_created", "conversation_closed", "problem_reported"];
    return order.filter(k => map[k]).map(k => ({ name: STEP_LABELS[k] ?? k, value: map[k] }));
  }, [saqueData]);

  const otpResultBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    otpData.forEach(o => { map[o.result] = (map[o.result] || 0) + 1; });
    return Object.entries(map)
      .map(([result, count]) => ({ name: OTP_RESULT_LABELS[result] ?? result, value: count, result }))
      .sort((a, b) => b.value - a.value);
  }, [otpData]);

  const hourlyData = useMemo(() => {
    const map: Record<string, number> = {};
    saqueData
      .filter(s => s.step === "intent_detected")
      .forEach(s => {
        const hour = s.created_at.slice(0, 13) + ":00";
        map[hour] = (map[hour] || 0) + 1;
      });
    return Object.entries(map)
      .map(([hour, count]) => ({ hour: hour.slice(11, 16), count }))
      .reverse();
  }, [saqueData]);

  const refetch = () => { refetchSaque(); refetchOtp(); };

  return {
    saqueData,
    otpData,
    isLoading: saqueLoading || otpLoading,
    isError: saqueError || otpError,
    refetch,
    kpis,
    stepBreakdown,
    otpResultBreakdown,
    hourlyData,
    lastUpdated,
  };
}
