import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

interface UseActivitiesOptions {
  contactId?: string;
  dealId?: string;
  completed?: boolean;
}

export function useActivities({ contactId, dealId, completed }: UseActivitiesOptions = {}) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["activities", contactId, dealId, completed, user?.id, role],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("activities")
        .select(`
          *,
          assigned_user:profiles!activities_assigned_to_fkey(id, full_name, avatar_url),
          contact:contacts(id, first_name, last_name),
          deal:deals(id, title)
        `)
        .order("due_date", { ascending: true });

      // Filtrar por contato se fornecido
      if (contactId) {
        query = query.eq("contact_id", contactId);
      }

      // Filtrar por deal se fornecido
      if (dealId) {
        query = query.eq("deal_id", dealId);
      }

      // Filtrar por status de conclusão se fornecido
      if (completed !== undefined) {
        query = query.eq("completed", completed);
      }

      // Sales rep vê apenas suas próprias atividades (filtro adicional de segurança)
      if (role === "sales_rep") {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !roleLoading,
  });
}
