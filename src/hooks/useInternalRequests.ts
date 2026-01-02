import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InternalRequest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  department_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  contact_id: string | null;
  form_submission_id: string | null;
  metadata: Record<string, any> | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  department?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string } | null;
  contact?: { id: string; first_name: string; last_name: string } | null;
}

export function useInternalRequests() {
  return useQuery({
    queryKey: ["internal-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_requests")
        .select(`
          *,
          department:departments(id, name),
          assignee:profiles!internal_requests_assigned_to_fkey(id, full_name),
          contact:contacts(id, first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InternalRequest[];
    },
  });
}

export function useUpdateInternalRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, any> = { status };
      
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("internal_requests")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-requests"] });
      toast.success("Status atualizado com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });
}

export function useAssignInternalRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, assigned_to }: { id: string; assigned_to: string | null }) => {
      const { error } = await supabase
        .from("internal_requests")
        .update({ assigned_to })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-requests"] });
      toast.success("Responsável atribuído");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atribuir: ${error.message}`);
    },
  });
}
