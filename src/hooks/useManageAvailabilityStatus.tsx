import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AvailabilityStatus = 'online' | 'busy' | 'away' | 'offline';

interface ManageAvailabilityParams {
  user_id: string;
  new_status: AvailabilityStatus;
  reason?: string;
}

export function useManageAvailabilityStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ user_id, new_status, reason }: ManageAvailabilityParams) => {
      // Get current user for audit log
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }

      // Get old status for audit
      const { data: oldProfile } = await supabase
        .from("profiles")
        .select("availability_status")
        .eq("id", user_id)
        .single();

      // Update the availability status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          availability_status: new_status,
          last_status_change: new Date().toISOString(),
          manual_offline: new_status === 'offline'
        })
        .eq("id", user_id);

      if (updateError) throw updateError;

      // Log the change in audit_logs
      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          user_id: currentUser.id,
          action: 'UPDATE',
          table_name: 'profiles',
          record_id: user_id,
          old_data: { availability_status: oldProfile?.availability_status },
          new_data: { 
            availability_status: new_status,
            changed_by_admin: true,
            reason: reason || null
          }
        });

      if (auditError) {
        console.error("Erro ao registrar audit log:", auditError);
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["team-online-status"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["availability-status"] });
      
      const statusLabels = {
        online: 'Online',
        busy: 'Ocupado',
        offline: 'Offline'
      };
      
      toast.success(`Status alterado para ${statusLabels[variables.new_status]}`);
    },
    onError: (error: any) => {
      console.error("Erro ao alterar status:", error);
      toast.error(error?.message || 'Erro ao alterar status de disponibilidade');
    }
  });
}
