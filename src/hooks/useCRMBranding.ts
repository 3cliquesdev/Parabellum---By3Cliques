import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CRMBranding {
  name: string;
  logo_url: string | null;
  header_color: string;
  primary_color: string;
}

const FALLBACK: CRMBranding = {
  name: "CRM",
  logo_url: null,
  header_color: "#0f172a",
  primary_color: "#1e3a5f",
};

export function useCRMBranding() {
  return useQuery({
    queryKey: ["crm-branding"],
    queryFn: async (): Promise<CRMBranding> => {
      const { data, error } = await supabase
        .from("email_branding")
        .select("name, logo_url, header_color, primary_color")
        .eq("is_default_employee", true)
        .maybeSingle();

      if (error) {
        console.warn("[useCRMBranding] Erro ao buscar branding:", error.message);
        return FALLBACK;
      }

      if (!data) return FALLBACK;

      return {
        name: data.name || FALLBACK.name,
        logo_url: data.logo_url || null,
        header_color: data.header_color || FALLBACK.header_color,
        primary_color: data.primary_color || FALLBACK.primary_color,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    gcTime: 30 * 60 * 1000,
  });
}
