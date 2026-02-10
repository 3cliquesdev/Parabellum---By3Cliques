import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TicketStatus {
  id: string;
  name: string;
  label: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  is_archived_status: boolean;
  is_final_status: boolean;
  display_order: number;
  send_email_notification: boolean;
  send_whatsapp_notification: boolean;
  email_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketStatusData {
  name: string;
  label: string;
  description?: string;
  color: string;
  icon: string;
  is_active?: boolean;
  is_archived_status?: boolean;
  is_final_status?: boolean;
  send_email_notification?: boolean;
  send_whatsapp_notification?: boolean;
  email_template_id?: string | null;
}

export interface UpdateTicketStatusData extends Partial<CreateTicketStatusData> {
  display_order?: number;
}

// Fetch all ticket statuses
export function useTicketStatuses() {
  return useQuery({
    queryKey: ["ticket-statuses"],
    queryFn: async (): Promise<TicketStatus[]> => {
      const { data, error } = await supabase
        .from("ticket_statuses")
        .select("*")
        .order("display_order");

      if (error) throw error;
      return data as TicketStatus[];
    },
  });
}

// Fetch only active ticket statuses
export function useActiveTicketStatuses() {
  return useQuery({
    queryKey: ["ticket-statuses", "active"],
    queryFn: async (): Promise<TicketStatus[]> => {
      const { data, error } = await supabase
        .from("ticket_statuses")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data as TicketStatus[];
    },
    staleTime: 10 * 60 * 1000, // 10min — statuses raramente mudam
  });
}

// Get status by name (for components that need quick lookup)
export function useTicketStatusByName(name: string) {
  const { data: statuses } = useActiveTicketStatuses();
  return statuses?.find(s => s.name === name);
}

// Create a new ticket status
export function useCreateTicketStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTicketStatusData): Promise<TicketStatus> => {
      // Get max display_order
      const { data: maxOrder } = await supabase
        .from("ticket_statuses")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const newOrder = (maxOrder?.display_order || 0) + 1;

      const { data: created, error } = await supabase
        .from("ticket_statuses")
        .insert({
          ...data,
          display_order: newOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return created as TicketStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-statuses"] });
      toast({ title: "Status criado com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Update an existing ticket status
export function useUpdateTicketStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateTicketStatusData }): Promise<TicketStatus> => {
      const { data, error } = await supabase
        .from("ticket_statuses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as TicketStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-statuses"] });
      toast({ title: "Status atualizado com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Delete a ticket status
export function useDeleteTicketStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Get the status name first
      const { data: statusData, error: statusError } = await supabase
        .from("ticket_statuses")
        .select("name")
        .eq("id", id)
        .single();

      if (statusError) throw statusError;

      // Check if any tickets are using this status
      // We need to cast to any because the status column is an enum
      const { count, error: checkError } = await supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", statusData.name as any);

      if (checkError) throw checkError;

      if (count && count > 0) {
        throw new Error(`Não é possível excluir este status. Existem ${count} ticket(s) usando-o.`);
      }

      const { error } = await supabase
        .from("ticket_statuses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-statuses"] });
      toast({ title: "Status excluído com sucesso" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Reorder ticket statuses
export function useReorderTicketStatuses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]): Promise<void> => {
      // Update each status with its new display_order
      const updates = orderedIds.map((id, index) => ({
        id,
        display_order: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("ticket_statuses")
          .update({ display_order: update.display_order })
          .eq("id", update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-statuses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao reordenar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Toggle notification settings
export function useToggleStatusNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      field, 
      value 
    }: { 
      id: string; 
      field: 'send_email_notification' | 'send_whatsapp_notification'; 
      value: boolean 
    }): Promise<void> => {
      const { error } = await supabase
        .from("ticket_statuses")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-statuses"] });
    },
  });
}

// Toggle active status
export function useToggleStatusActive() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }): Promise<void> => {
      const { error } = await supabase
        .from("ticket_statuses")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ticket-statuses"] });
      toast({ 
        title: variables.is_active ? "Status ativado" : "Status desativado" 
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
