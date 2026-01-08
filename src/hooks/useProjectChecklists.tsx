import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProjectChecklistItem {
  id: string;
  checklist_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  position: number;
  due_date: string | null;
}

export interface ProjectChecklist {
  id: string;
  card_id: string;
  title: string;
  position: number;
  created_at: string;
  items?: ProjectChecklistItem[];
}

export function useProjectChecklists(cardId: string | undefined) {
  return useQuery({
    queryKey: ["project-checklists", cardId],
    queryFn: async () => {
      if (!cardId) return [];

      const { data, error } = await supabase
        .from("project_checklists")
        .select(`
          *,
          items:project_checklist_items(*)
        `)
        .eq("card_id", cardId)
        .order("position", { ascending: true });

      if (error) throw error;
      
      // Sort items by position
      return (data as ProjectChecklist[]).map((checklist) => ({
        ...checklist,
        items: checklist.items?.sort((a, b) => a.position - b.position),
      }));
    },
    enabled: !!cardId,
  });
}

export function useCreateProjectChecklist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      card_id,
      title,
    }: {
      card_id: string;
      title: string;
    }) => {
      // Get max position
      const { data: checklists } = await supabase
        .from("project_checklists")
        .select("position")
        .eq("card_id", card_id)
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = checklists?.[0]?.position ?? -1;

      const { data, error } = await supabase
        .from("project_checklists")
        .insert({
          card_id,
          title,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", variables.card_id] });
      toast({ title: "Checklist criado!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar checklist",
        description: error.message,
      });
    },
  });
}

export function useDeleteProjectChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      card_id,
    }: {
      id: string;
      card_id: string;
    }) => {
      const { error } = await supabase
        .from("project_checklists")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", variables.card_id] });
    },
  });
}

export function useCreateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      checklist_id,
      card_id,
      title,
    }: {
      checklist_id: string;
      card_id: string;
      title: string;
    }) => {
      // Get max position
      const { data: items } = await supabase
        .from("project_checklist_items")
        .select("position")
        .eq("checklist_id", checklist_id)
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = items?.[0]?.position ?? -1;

      const { data, error } = await supabase
        .from("project_checklist_items")
        .insert({
          checklist_id,
          title,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", variables.card_id] });
    },
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      card_id,
      ...data
    }: {
      id: string;
      card_id: string;
      title?: string;
      is_completed?: boolean;
      due_date?: string | null;
    }) => {
      const updateData: Record<string, unknown> = { ...data };

      if (data.is_completed !== undefined) {
        if (data.is_completed) {
          const { data: { user } } = await supabase.auth.getUser();
          updateData.completed_at = new Date().toISOString();
          updateData.completed_by = user?.id;
        } else {
          updateData.completed_at = null;
          updateData.completed_by = null;
        }
      }

      const { error } = await supabase
        .from("project_checklist_items")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", variables.card_id] });
    },
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      card_id,
    }: {
      id: string;
      card_id: string;
    }) => {
      const { error } = await supabase
        .from("project_checklist_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", variables.card_id] });
    },
  });
}
