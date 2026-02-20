import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogField {
  id: string;
  entity: string;
  field_name: string;
  field_type: string;
  label: string;
  is_sensitive: boolean;
  allow_filter: boolean;
  allow_group: boolean;
  allow_aggregate: boolean;
  category: string;
}

export function useDataCatalog() {
  const entitiesQuery = useQuery({
    queryKey: ["data-catalog-entities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_catalog")
        .select("entity")
        .order("entity");
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.entity))];
      return unique as string[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const getFieldsForEntity = (entity: string | null) => {
    return useQuery({
      queryKey: ["data-catalog-fields", entity],
      queryFn: async () => {
        if (!entity) return [];
        const { data, error } = await supabase
          .from("data_catalog")
          .select("*")
          .eq("entity", entity)
          .order("field_name");
        if (error) throw error;
        return (data || []) as CatalogField[];
      },
      enabled: !!entity,
      staleTime: 5 * 60 * 1000,
    });
  };

  return { entities: entitiesQuery, getFieldsForEntity };
}
