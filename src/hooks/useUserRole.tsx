import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type AppRole = "admin" | "user" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager" | "cs_manager" | "general_manager" | null;

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) {
        console.log("useUserRole: No user logged in");
        return null;
      }

      console.log("useUserRole: [DEBUG] Starting role fetch for user:", {
        user_id: user.id,
        user_email: user.email
      });

      console.log("useUserRole: [DEBUG] Executing query to user_roles...");
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      console.log("useUserRole: [DEBUG] Query completed", {
        data,
        error,
        hasData: !!data,
        hasError: !!error
      });

      if (error) {
        console.error("useUserRole: [ERROR] Failed to fetch role", {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return null;
      }

      console.log("useUserRole: [SUCCESS] Role fetched successfully", {
        role: data?.role,
        isAdmin: data?.role === "admin"
      });
      
      return data?.role as AppRole;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Loading é true se auth ainda está carregando OU se role está carregando
  const loading = authLoading || roleLoading;

  return {
    role: role ?? null,
    loading,
    isAdmin: role === "admin",
    isUser: role === "user",
    isManager: role === "manager",
    isSalesRep: role === "sales_rep",
    isConsultant: role === "consultant",
    isSupportAgent: role === "support_agent",
    isSupportManager: role === "support_manager",
    isFinancialManager: role === "financial_manager",
    isCSManager: role === "cs_manager",
    isGeneralManager: role === "general_manager",
  };
}
