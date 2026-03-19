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
  description: boolean;
  attachments: boolean;
}

export interface TicketFieldVisibility {
  department: boolean;
  operation: boolean;
  origin: boolean;
  category: boolean;
  customer: boolean;
  assigned_to: boolean;
  tags: boolean;
  description: boolean;
  attachments: boolean;
}

const FIELD_KEYS: Record<keyof TicketFieldSettings, string> = {
  department: "ticket_field_department_required",
  operation: "ticket_field_operation_required",
  origin: "ticket_field_origin_required",
  category: "ticket_field_category_required",
  customer: "ticket_field_customer_required",
  assigned_to: "ticket_field_assigned_to_required",
  tags: "ticket_field_tags_required",
  description: "ticket_field_description_required",
  attachments: "ticket_field_attachments_required",
};

const VISIBILITY_KEYS: Record<keyof TicketFieldVisibility, string> = {
  department: "ticket_field_department_visible",
  operation: "ticket_field_operation_visible",
  origin: "ticket_field_origin_visible",
  category: "ticket_field_category_visible",
  customer: "ticket_field_customer_visible",
  assigned_to: "ticket_field_assigned_to_visible",
  tags: "ticket_field_tags_visible",
  description: "ticket_field_description_visible",
  attachments: "ticket_field_attachments_visible",
};

const DEFAULTS: TicketFieldSettings = {
  department: false,
  operation: true,
  origin: true,
  category: false,
  customer: false,
  assigned_to: false,
  tags: false,
  description: false,
  attachments: false,
};

const VISIBILITY_DEFAULTS: TicketFieldVisibility = {
  department: true,
  operation: true,
  origin: true,
  category: true,
  customer: true,
  assigned_to: true,
  tags: true,
  description: true,
  attachments: true,
};

export function useTicketFieldSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ticket-field-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("key, value")
        .eq("category", "tickets")
        .like("key", "ticket_field_%");

      if (error) {
        console.error("[useTicketFieldSettings] Error:", error);
        return { settings: DEFAULTS, visibility: VISIBILITY_DEFAULTS };
      }

      const map = new Map(data?.map((r) => [r.key, r.value]) || []);
      
      const settings: TicketFieldSettings = { ...DEFAULTS };
      for (const [field, key] of Object.entries(FIELD_KEYS)) {
        const val = map.get(key);
        if (val !== undefined) {
          (settings as any)[field] = val === "true";
        }
      }

      const visibility: TicketFieldVisibility = { ...VISIBILITY_DEFAULTS };
      for (const [field, key] of Object.entries(VISIBILITY_KEYS)) {
        const val = map.get(key);
        if (val !== undefined) {
          (visibility as any)[field] = val === "true";
        }
      }

      return { settings, visibility };
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
    },
    onMutate: async ({ field, required }) => {
      await queryClient.cancelQueries({ queryKey: ["ticket-field-settings"] });
      const previous = queryClient.getQueryData<{ settings: TicketFieldSettings; visibility: TicketFieldVisibility }>(["ticket-field-settings"]);
      queryClient.setQueryData<{ settings: TicketFieldSettings; visibility: TicketFieldVisibility }>(["ticket-field-settings"], (old) =>
        old ? { ...old, settings: { ...old.settings, [field]: required } } : old
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

  const updateVisibility = useMutation({
    mutationFn: async ({ field, visible }: { field: keyof TicketFieldVisibility; visible: boolean }) => {
      const key = VISIBILITY_KEYS[field];
      const { error } = await supabase
        .from("system_configurations")
        .upsert(
          {
            key,
            value: visible ? "true" : "false",
            category: "tickets",
            description: `Campo ${field} visível na criação de ticket`,
          },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onMutate: async ({ field, visible }) => {
      await queryClient.cancelQueries({ queryKey: ["ticket-field-settings"] });
      const previous = queryClient.getQueryData<{ settings: TicketFieldSettings; visibility: TicketFieldVisibility }>(["ticket-field-settings"]);
      queryClient.setQueryData<{ settings: TicketFieldSettings; visibility: TicketFieldVisibility }>(["ticket-field-settings"], (old) =>
        old ? { ...old, visibility: { ...old.visibility, [field]: visible } } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["ticket-field-settings"], context.previous);
      }
      toast.error("Erro ao atualizar visibilidade");
    },
    onSuccess: () => {
      toast.success("Visibilidade atualizada");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-field-settings"] });
    },
  });

  return {
    settings: data?.settings ?? DEFAULTS,
    visibility: data?.visibility ?? VISIBILITY_DEFAULTS,
    isLoading,
    updateField: updateField.mutate,
    updateVisibility: updateVisibility.mutate,
  };
}
