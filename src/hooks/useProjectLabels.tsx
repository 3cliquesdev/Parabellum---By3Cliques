import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProjectLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export function useProjectLabels(boardId: string | undefined) {
  return useQuery({
    queryKey: ["project-labels", boardId],
    queryFn: async () => {
      if (!boardId) return [];

      const { data, error } = await supabase
        .from("project_labels")
        .select("*")
        .eq("board_id", boardId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as ProjectLabel[];
    },
    enabled: !!boardId,
  });
}

export function useCreateProjectLabel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      board_id,
      name,
      color,
    }: {
      board_id: string;
      name: string;
      color: string;
    }) => {
      const { data, error } = await supabase
        .from("project_labels")
        .insert({ board_id, name, color })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-labels", variables.board_id] });
      toast({ title: "Label criado!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar label",
        description: error.message,
      });
    },
  });
}

export function useUpdateProjectLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      board_id,
      name,
      color,
    }: {
      id: string;
      board_id: string;
      name?: string;
      color?: string;
    }) => {
      const { data, error } = await supabase
        .from("project_labels")
        .update({ name, color })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-labels", variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
    },
  });
}

export function useDeleteProjectLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      board_id,
    }: {
      id: string;
      board_id: string;
    }) => {
      const { error } = await supabase
        .from("project_labels")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-labels", variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
    },
  });
}

export function useAddCardLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      card_id,
      label_id,
      board_id,
    }: {
      card_id: string;
      label_id: string;
      board_id: string;
    }) => {
      const { error } = await supabase
        .from("project_card_labels")
        .insert({ card_id, label_id });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ["project-card", variables.card_id] });
    },
  });
}

export function useRemoveCardLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      card_id,
      label_id,
      board_id,
    }: {
      card_id: string;
      label_id: string;
      board_id: string;
    }) => {
      const { error } = await supabase
        .from("project_card_labels")
        .delete()
        .eq("card_id", card_id)
        .eq("label_id", label_id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ["project-card", variables.card_id] });
    },
  });
}
