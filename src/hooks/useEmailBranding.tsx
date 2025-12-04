import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmailBranding {
  id: string;
  name: string;
  logo_url: string | null;
  header_color: string;
  primary_color: string;
  footer_text: string | null;
  footer_logo_url: string | null;
  is_default_customer: boolean;
  is_default_employee: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailBrandings() {
  return useQuery({
    queryKey: ["email-brandings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_branding")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailBranding[];
    },
  });
}

export function useEmailBranding(id: string | undefined) {
  return useQuery({
    queryKey: ["email-brandings", id],
    queryFn: async () => {
      if (!id) throw new Error("ID is required");

      const { data, error } = await supabase
        .from("email_branding")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as EmailBranding;
    },
    enabled: !!id,
  });
}

export function useDefaultCustomerBranding() {
  return useQuery({
    queryKey: ["email-brandings", "default-customer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_branding")
        .select("*")
        .eq("is_default_customer", true)
        .single();

      if (error) throw error;
      return data as EmailBranding;
    },
  });
}

export function useCreateEmailBranding() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (branding: Omit<EmailBranding, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("email_branding")
        .insert(branding)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-brandings"] });
      toast({
        title: "Branding criado",
        description: "Configuração de branding criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar branding",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateEmailBranding() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EmailBranding> }) => {
      const { data, error } = await supabase
        .from("email_branding")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-brandings"] });
      toast({
        title: "Branding atualizado",
        description: "Alterações salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar branding",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteEmailBranding() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_branding")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-brandings"] });
      toast({
        title: "Branding excluído",
        description: "Configuração removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir branding",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
