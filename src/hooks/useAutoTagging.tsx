import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAutoTagging() {
  return useMutation({
    mutationFn: async ({ description, subject }: { description: string; subject: string }) => {
      const { data, error } = await supabase.functions.invoke('analyze-ticket', {
        body: { 
          mode: 'tags', 
          description,
          ticketSubject: subject
        }
      });

      if (error) throw error;
      
      // Parse comma-separated tags
      const tags = data.result.split(',').map((tag: string) => tag.trim());
      return tags as string[];
    },
  });
}
