import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

interface UseCadenceTasksOptions {
  date?: string; // Format: 'YYYY-MM-DD'
  status?: string;
  taskType?: string;
}

export function useCadenceTasks({ date, status = "pending", taskType }: UseCadenceTasksOptions = {}) {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["cadence-tasks", date, status, taskType, user?.id],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("cadence_tasks")
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone, company, avatar_url),
          enrollment:cadence_enrollments(
            id,
            current_step,
            cadence:cadences(id, name)
          ),
          step:cadence_steps(id, step_type, position)
        `)
        .order("scheduled_for", { ascending: true });

      // Filter by date
      if (date) {
        query = query.eq("scheduled_for", date);
      } else {
        // Default to today if no date specified
        const today = new Date().toISOString().split("T")[0];
        query = query.eq("scheduled_for", today);
      }

      // Filter by status
      if (status) {
        query = query.eq("status", status);
      }

      // Filter by task type
      if (taskType) {
        query = query.eq("task_type", taskType);
      }

      // Sales rep only sees their own tasks
      if (role === "sales_rep") {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
