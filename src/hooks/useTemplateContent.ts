import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTemplateContent(templateName: string | null) {
  return useQuery({
    queryKey: ["template-content", templateName],
    queryFn: async () => {
      if (!templateName) return null;
      const { data, error } = await supabase
        .from("whatsapp_message_templates")
        .select("name, description, body_text")
        .ilike("name", templateName)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.body_text || data?.description || null;
    },
    enabled: !!templateName,
    staleTime: 10 * 60 * 1000,
  });
}
