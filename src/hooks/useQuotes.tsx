import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Quote = Tables<"quotes">;
type QuoteInsert = Partial<Quote> & {
  deal_id: string;
  contact_id: string;
  status?: Quote["status"];
  total_amount: number;
};
type QuoteUpdate = Partial<Omit<Quote, "id" | "created_at" | "updated_at">>;

// Fetch all quotes
export const useQuotes = () => {
  return useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          deals:deal_id(id, title, contact_id, assigned_to),
          contacts:contact_id(id, first_name, last_name, email, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

// Fetch single quote by ID
export const useQuote = (id?: string) => {
  return useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          deals:deal_id(id, title, contact_id, assigned_to),
          contacts:contact_id(id, first_name, last_name, email, phone, company)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

// Fetch quote by signature token (for public page)
export const useQuoteByToken = (token?: string) => {
  return useQuery({
    queryKey: ["quote-public", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          deals:deal_id(id, title),
          contacts:contact_id(id, first_name, last_name, email, phone, company)
        `)
        .eq("signature_token", token)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
};

// Create quote
export const useCreateQuote = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quote: Partial<Quote> & { deal_id: string; contact_id: string; status?: Quote["status"]; total_amount: number }) => {
      const { data, error } = await supabase
        .from("quotes")
        .insert(quote as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({
        title: "Proposta criada",
        description: "A proposta foi criada com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar proposta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Update quote
export const useUpdateQuote = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: QuoteUpdate }) => {
      const { data, error } = await supabase
        .from("quotes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", variables.id] });
      toast({
        title: "Proposta atualizada",
        description: "As alterações foram salvas",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar proposta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Delete quote
export const useDeleteQuote = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({
        title: "Proposta excluída",
        description: "A proposta foi removida",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir proposta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Send quote (change status to 'sent')
export const useSendQuote = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("quotes")
        .update({ status: "sent" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      toast({
        title: "Proposta enviada",
        description: "A proposta foi enviada para o cliente",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar proposta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
