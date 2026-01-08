import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProjectColumn {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  is_final: boolean;
  email_template_id: string | null;
  notify_client_on_enter: boolean;
  created_at: string;
}

export function useProjectColumns(boardId: string | undefined) {
  return useQuery({
    queryKey: ["project-columns", boardId],
    queryFn: async () => {
      if (!boardId) return [];

      const { data, error } = await supabase
        .from("project_columns")
        .select("*")
        .eq("board_id", boardId)
        .order("position", { ascending: true });

      if (error) throw error;
      return data as ProjectColumn[];
    },
    enabled: !!boardId,
  });
}

export function useCreateProjectColumn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      board_id: string;
      name: string;
      color?: string;
      position?: number;
      is_final?: boolean;
      notify_client_on_enter?: boolean;
    }) => {
      // Get max position
      const { data: columns } = await supabase
        .from("project_columns")
        .select("position")
        .eq("board_id", data.board_id)
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = columns?.[0]?.position ?? -1;

      const { data: column, error } = await supabase
        .from("project_columns")
        .insert({
          ...data,
          position: data.position ?? maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return column;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-columns", variables.board_id] });
      toast({ title: "Coluna criada!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar coluna",
        description: error.message,
      });
    },
  });
}

export function useUpdateProjectColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      board_id,
      ...data
    }: {
      id: string;
      board_id: string;
      name?: string;
      color?: string;
      position?: number;
      is_final?: boolean;
      email_template_id?: string | null;
      notify_client_on_enter?: boolean;
    }) => {
      const { data: column, error } = await supabase
        .from("project_columns")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return column;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-columns", variables.board_id] });
    },
  });
}

export function useReorderProjectColumns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      boardId,
      columns,
    }: {
      boardId: string;
      columns: Array<{ id: string; position: number }>;
    }) => {
      const updates = columns.map((col) =>
        supabase
          .from("project_columns")
          .update({ position: col.position })
          .eq("id", col.id)
      );

      await Promise.all(updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-columns", variables.boardId] });
    },
  });
}

export function useDeleteProjectColumn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, board_id }: { id: string; board_id: string }) => {
      const { error } = await supabase
        .from("project_columns")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-columns", variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
      toast({ title: "Coluna excluída!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir coluna",
        description: error.message,
      });
    },
  });
}
