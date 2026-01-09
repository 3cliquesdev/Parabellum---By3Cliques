import { useQuery } from "@tanstack/react-query";
import { FormSchema } from "@/hooks/useForms";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface PublicFormData {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  schema: FormSchema;
}

export function usePublicFormSchema(formId: string | undefined) {
  return useQuery({
    queryKey: ["public-form", formId],
    queryFn: async (): Promise<PublicFormData | null> => {
      if (!formId) throw new Error("Form ID is required");

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/form-public-api/${formId}/schema`,
        {
          method: "GET",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error("Failed to load form");
      }

      const data = await response.json();
      return data as PublicFormData;
    },
    enabled: !!formId,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
