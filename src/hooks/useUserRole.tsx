import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type AppRole = "admin" | "user" | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      console.log("useUserRole: No user logged in");
      setRole(null);
      setLoading(false);
      return;
    }

    console.log("useUserRole: [DEBUG] Starting role fetch for user:", {
      user_id: user.id,
      user_email: user.email
    });

    const fetchRole = async () => {
      try {
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
          setRole(null);
        } else {
          console.log("useUserRole: [SUCCESS] Role fetched successfully", {
            role: data?.role,
            isAdmin: data?.role === "admin"
          });
          setRole(data?.role as AppRole);
        }
      } catch (error) {
        console.error("useUserRole: [CRITICAL] Unexpected error in fetchRole", error);
        setRole(null);
      } finally {
        console.log("useUserRole: [DEBUG] Setting loading to false");
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isUser: role === "user",
  };
}
