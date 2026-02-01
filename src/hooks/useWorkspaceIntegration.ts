import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface IntegrationData {
  id?: string;
  provider: string;
  workspace_id?: string;
  public_config: Record<string, unknown>;
  secrets_masked: Record<string, string>;
  status: "active" | "inactive" | "error" | "not_configured";
  is_configured: boolean;
  last_error?: string | null;
  last_checked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TestResult {
  success: boolean;
  provider: string;
  error?: string;
  details?: unknown;
  tested_at: string;
}

export function useWorkspaceIntegration(provider: string, workspaceId?: string) {
  const [integration, setIntegration] = useState<IntegrationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const fetchIntegration = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const params = new URLSearchParams({ provider });
      if (workspaceId) params.append("workspace_id", workspaceId);

      const { data, error } = await supabase.functions.invoke("integrations-get", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: null,
        method: "GET",
      });

      // Since invoke doesn't support query params well, we use POST with body
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integrations-get?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setIntegration(result);
      return result;
    } catch (error) {
      console.error("[useWorkspaceIntegration] Fetch error:", error);
      setIntegration({
        provider,
        public_config: {},
        secrets_masked: {},
        status: "not_configured",
        is_configured: false,
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [provider, workspaceId]);

  const saveIntegration = useCallback(async (
    secrets: Record<string, string>,
    publicConfig?: Record<string, unknown>
  ) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integrations-set`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider,
            secrets,
            public_config: publicConfig,
            workspace_id: workspaceId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      toast({
        title: "Integração salva",
        description: `Credenciais do ${provider} atualizadas com sucesso.`,
      });

      // Refresh integration data
      await fetchIntegration();
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar";
      toast({
        title: "Erro ao salvar",
        description: message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }, [provider, workspaceId, toast, fetchIntegration]);

  const testIntegration = useCallback(async (): Promise<TestResult> => {
    setTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integrations-test`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider,
            workspace_id: workspaceId,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Conexão bem-sucedida",
          description: `${provider} está funcionando corretamente.`,
        });
      } else {
        toast({
          title: "Falha na conexão",
          description: result.error || "Verifique as credenciais.",
          variant: "destructive",
        });
      }

      // Refresh integration data to get updated status
      await fetchIntegration();

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao testar";
      toast({
        title: "Erro ao testar",
        description: message,
        variant: "destructive",
      });
      return {
        success: false,
        provider,
        error: message,
        tested_at: new Date().toISOString(),
      };
    } finally {
      setTesting(false);
    }
  }, [provider, workspaceId, toast, fetchIntegration]);

  return {
    integration,
    loading,
    saving,
    testing,
    fetchIntegration,
    saveIntegration,
    testIntegration,
  };
}
