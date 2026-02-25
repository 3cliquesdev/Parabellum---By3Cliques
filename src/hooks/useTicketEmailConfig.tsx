import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EMAIL_CONFIG_KEYS = [
  "ticket_email_customer_created",
  "ticket_email_customer_resolved",
  "ticket_email_customer_comment",
] as const;

type EmailConfigKey = typeof EMAIL_CONFIG_KEYS[number];

interface TicketEmailConfig {
  created: boolean;
  resolved: boolean;
  comment: boolean;
}

const KEY_MAP: Record<EmailConfigKey, keyof TicketEmailConfig> = {
  ticket_email_customer_created: "created",
  ticket_email_customer_resolved: "resolved",
  ticket_email_customer_comment: "comment",
};

function parseBool(value: string | undefined | null, fallback = true): boolean {
  if (value === undefined || value === null) return fallback;
  return value !== "false";
}

export function useTicketEmailConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["ticket-email-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("key, value")
        .in("key", [...EMAIL_CONFIG_KEYS]);

      if (error) throw error;

      const result: TicketEmailConfig = {
        created: true,
        resolved: true,
        comment: true,
      };

      for (const row of data || []) {
        const field = KEY_MAP[row.key as EmailConfigKey];
        if (field) {
          result[field] = parseBool(row.value);
        }
      }

      return result;
    },
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: EmailConfigKey; enabled: boolean }) => {
      const { error } = await supabase
        .from("system_configurations")
        .upsert(
          {
            key,
            value: String(enabled),
            category: "ticket_email",
            description: `Email ao cliente: ${key}`,
          },
          { onConflict: "key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-email-config"] });
      toast.success("Configuração salva");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar configuração");
    },
  });

  const toggleConfig = (key: EmailConfigKey, enabled: boolean) => {
    toggleMutation.mutate({ key, enabled });
  };

  return {
    config: config ?? { created: true, resolved: true, comment: true },
    isLoading,
    toggleConfig,
    isToggling: toggleMutation.isPending,
  };
}
