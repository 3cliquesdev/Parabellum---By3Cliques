import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  whatsapp_number?: string | null;
  parent_id?: string | null;
  // Auto-close settings
  auto_close_enabled: boolean;
  auto_close_minutes: number | null;
  send_rating_on_close: boolean;
  ai_auto_close_minutes: number | null;
  human_auto_close_minutes: number | null;
  human_auto_close_tag_id: string | null;
  created_at: string;
  updated_at: string;
}

interface UseDepartmentsOptions {
  /** Only fetch active departments (default: false for backward compatibility) */
  activeOnly?: boolean;
}

export function useDepartments(options: UseDepartmentsOptions = {}) {
  const { activeOnly = false } = options;
  
  return useQuery({
    queryKey: ["departments", { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from("departments")
        .select("*");
      
      // Filter by active status if requested
      if (activeOnly) {
        query = query.eq("is_active", true);
      }
      
      const { data, error } = await query.order("name");

      if (error) throw error;
      return data as Department[];
    },
    // Cache for 5 minutes - departments rarely change
    staleTime: 5 * 60 * 1000,
    // Keep in cache for 10 minutes
    gcTime: 10 * 60 * 1000,
  });
}
