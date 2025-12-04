import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmailSender {
  id: string;
  name: string;
  from_name: string;
  from_email: string;
  department_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailSenders() {
  return useQuery({
    queryKey: ["email-senders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_senders")
        .select("*, departments(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as (EmailSender & { departments: { name: string } | null })[];
    },
  });
}

export function useDefaultEmailSender() {
  return useQuery({
    queryKey: ["email-senders", "default"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_senders")
        .select("*")
        .eq("is_default", true)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as EmailSender | null;
    },
  });
}

export function useSenderByDepartment(departmentId: string | null) {
  return useQuery({
    queryKey: ["email-senders", "department", departmentId],
    queryFn: async () => {
      if (!departmentId) {
        // Return default sender if no department
        const { data, error } = await supabase
          .from("email_senders")
          .select("*")
          .eq("is_default", true)
          .single();
        
        if (error && error.code !== "PGRST116") throw error;
        return data as EmailSender | null;
      }

      const { data, error } = await supabase
        .from("email_senders")
        .select("*")
        .eq("department_id", departmentId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as EmailSender | null;
    },
    enabled: true,
  });
}

export function useCreateEmailSender() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sender: Omit<EmailSender, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("email_senders")
        .insert(sender)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-senders"] });
      toast({
        title: "Remetente criado",
        description: "Configuração de remetente criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar remetente",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateEmailSender() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EmailSender> }) => {
      const { data, error } = await supabase
        .from("email_senders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-senders"] });
      toast({
        title: "Remetente atualizado",
        description: "Alterações salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar remetente",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteEmailSender() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_senders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-senders"] });
      toast({
        title: "Remetente excluído",
        description: "Configuração removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir remetente",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
