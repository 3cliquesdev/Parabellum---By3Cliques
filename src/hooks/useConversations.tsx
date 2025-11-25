import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact;
  department_data?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
    department: string | null;
  } | null;
};

export function useConversations() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["conversations", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("conversations")
        .select(`
          *,
          contacts(*, organizations(*)),
          department_data:departments!department(id, name, color),
          assigned_user:profiles!assigned_to(id, full_name, avatar_url, job_title, department)
        `);

      // Filtrar por assigned_to se for sales_rep
      if (role && (role as string) === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query.order("last_message_at", { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          contact_id: contactId,
          channel: "whatsapp",
          status: "open",
        })
        .select("*, contacts(*)")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({
        title: "Conversa iniciada",
        description: "Nova conversa criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar conversa",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
