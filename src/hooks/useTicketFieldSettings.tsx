import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TicketFieldSettings {
  department: boolean;
  operation: boolean;
  origin: boolean;
  category: boolean;
  customer: boolean;
  assigned_to: boolean;
  tags: boolean;
}

const FIELD_KEYS: Record<keyof TicketFieldSettings, string> = {
  department: "ticket_field_department_required",
  operation: "ticket_field_operation_required",
  origin: "ticket_field_origin_required",
  category: "ticket_field_category_required",
  customer: "ticket_field_customer_required",
  assigned_to: "ticket_field_assigned_to_required",
  tags: "ticket_field_tags_required",
};

const DEFAULTS: TicketFieldSettings = {
  department: false,
  operation: true,
  origin: true,
  category: false,
  customer: false,
  assigned_to: false,
  tags: false,
};

export function useTicketFieldSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["ticket-field-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("key, value")
        .eq("category", "tickets")
        .like("key", "ticket_field_%_required");

      if (error) {
        console.error("[useTicketFieldSettings] Error:", error);
        return DEFAULTS;
      }

      const map = new Map(data?.map((r) => [r.key, r.value]) || []);
      const result: TicketFieldSettings = { ...DEFAULTS };

      for (const [field, key] of Object.entries(FIELD_KEYS)) {
        const val = map.get(key);
        if (val !== undefined) {
          (result as any)[field] = val === "true";
        }
      }

      return result;
    },
    staleTime: 30000,
  });

  const updateField = useMutation({
    mutationFn: async ({ field, required }: { field: keyof TicketFieldSettings; required: boolean }) => {
      const key = FIELD_KEYS[field];
      const { error } = await supabase
        .from("system_configurations")
        .upsert(
          {
            key,
            value: required ? "true" : "false",
            category: "tickets",
            description: `Campo ${field} obrigatório na criação de ticket`,
          },
          { onConflict: "key" }
        );
      if (error) throw error;

      // Verificação pós-upsert
      const { data: check } = await supabase
        .from("system_configurations")
        .select("value")
        .eq("key", key)
        .single();

      if (!check || check.value !== (required ? "true" : "false")) {
        throw new Error(`Falha ao persistir configuração ${key}`);
      }
    },
    onMutate: async ({ field, required }) => {
      await queryClient.cancelQueries({ queryKey: ["ticket-field-settings"] });
      const previous = queryClient.getQueryData<TicketFieldSettings>(["ticket-field-settings"]);
      queryClient.setQueryData<TicketFieldSettings>(["ticket-field-settings"], (old) =>
        old ? { ...old, [field]: required } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["ticket-field-settings"], context.previous);
      }
      toast.error("Erro ao atualizar configuração");
    },
    onSuccess: () => {
      toast.success("Configuração atualizada");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-field-settings"] });
    },
  });

  return {
    settings: settings ?? DEFAULTS,
    isLoading,
    updateField: updateField.mutate,
  };
}
