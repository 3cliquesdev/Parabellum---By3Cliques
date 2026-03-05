import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useOrganizationContacts(orgId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const contactsQuery = useQuery({
    queryKey: ["organization-contacts", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, phone, email")
        .eq("organization_id", orgId!)
        .order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const addContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ organization_id: orgId })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-contacts", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({ title: "Contato adicionado à organização" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao adicionar contato", description: err.message, variant: "destructive" });
    },
  });

  const removeContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ organization_id: null })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-contacts", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({ title: "Contato removido da organização" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover contato", description: err.message, variant: "destructive" });
    },
  });

  return { contacts: contactsQuery, addContact, removeContact };
}

export function useSearchContactsForOrg(orgId: string | null, search: string) {
  return useQuery({
    queryKey: ["contacts-search-for-org", orgId, search],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("id, first_name, last_name, phone, email, organization_id, organizations(name)")
        .neq("organization_id", orgId!)
        .order("first_name")
        .limit(20);

      if (search.trim()) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && search.length >= 2,
  });
}
