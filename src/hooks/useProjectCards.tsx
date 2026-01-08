import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProjectCardAssignee {
  id: string;
  user_id: string;
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ProjectCardLabel {
  label_id: string;
  label?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface ProjectCard {
  id: string;
  column_id: string;
  board_id: string;
  title: string;
  description: string | null;
  position: number;
  due_date: string | null;
  start_date: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  estimated_hours: number | null;
  actual_hours: number | null;
  cover_image_url: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignees?: ProjectCardAssignee[];
  labels?: ProjectCardLabel[];
  checklists_count?: number;
  checklists_completed?: number;
  comments_count?: number;
  attachments_count?: number;
}

export function useProjectCards(boardId: string | undefined) {
  return useQuery({
    queryKey: ["project-cards", boardId],
    queryFn: async () => {
      if (!boardId) return [];

      const { data, error } = await supabase
        .from("project_cards")
        .select(`
          *,
          assignees:project_card_assignees(
            id,
            user_id,
            profile:profiles!project_card_assignees_user_id_fkey(id, full_name, avatar_url)
          ),
          labels:project_card_labels(
            label_id,
            label:project_labels(id, name, color)
          )
        `)
        .eq("board_id", boardId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data as unknown as ProjectCard[]) ?? [];
    },
    enabled: !!boardId,
  });
}

export function useProjectCard(cardId: string | undefined) {
  return useQuery({
    queryKey: ["project-card", cardId],
    queryFn: async () => {
      if (!cardId) return null;

      const { data, error } = await supabase
        .from("project_cards")
        .select(`
          *,
          assignees:project_card_assignees(
            id,
            user_id,
            profile:profiles!project_card_assignees_user_id_fkey(id, full_name, avatar_url)
          ),
          labels:project_card_labels(
            label_id,
            label:project_labels(id, name, color)
          )
        `)
        .eq("id", cardId)
        .single();

      if (error) throw error;
      return data as unknown as ProjectCard;
    },
    enabled: !!cardId,
  });
}

export function useCreateProjectCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      board_id: string;
      column_id: string;
      title: string;
      description?: string;
      priority?: "low" | "medium" | "high" | "urgent";
      due_date?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get max position in column
      const { data: cards } = await supabase
        .from("project_cards")
        .select("position")
        .eq("column_id", data.column_id)
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = cards?.[0]?.position ?? -1;

      const { data: card, error } = await supabase
        .from("project_cards")
        .insert({
          ...data,
          position: maxPosition + 1,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return card;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
      toast({ title: "Card criado!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar card",
        description: error.message,
      });
    },
  });
}

export function useUpdateProjectCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      board_id,
      ...data
    }: {
      id: string;
      board_id: string;
      title?: string;
      description?: string | null;
      priority?: "low" | "medium" | "high" | "urgent";
      due_date?: string | null;
      start_date?: string | null;
      estimated_hours?: number | null;
      actual_hours?: number | null;
      cover_image_url?: string | null;
      is_completed?: boolean;
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

      const { data: card, error } = await supabase
        .from("project_cards")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return card;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ["project-card", variables.id] });
    },
  });
}

export function useMoveProjectCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      boardId,
      newColumnId,
      newPosition,
      oldColumnId,
    }: {
      cardId: string;
      boardId: string;
      newColumnId: string;
      newPosition: number;
      oldColumnId: string;
    }) => {
      // Update the card's column and position
      const { error } = await supabase
        .from("project_cards")
        .update({
          column_id: newColumnId,
          position: newPosition,
        })
        .eq("id", cardId);

      if (error) throw error;

      // Reorder cards in new column
      const { data: cardsInNewColumn } = await supabase
        .from("project_cards")
        .select("id, position")
        .eq("column_id", newColumnId)
        .neq("id", cardId)
        .order("position", { ascending: true });

      if (cardsInNewColumn) {
        const updates = cardsInNewColumn
          .filter((c) => c.position >= newPosition)
          .map((c, idx) =>
            supabase
              .from("project_cards")
              .update({ position: newPosition + idx + 1 })
              .eq("id", c.id)
          );
        await Promise.all(updates);
      }

      // Log activity
      await supabase.from("project_activity_log").insert({
        board_id: boardId,
        card_id: cardId,
        action: "card_moved",
        old_value: { column_id: oldColumnId },
        new_value: { column_id: newColumnId },
      });
    },
    onMutate: async ({ cardId, boardId, newColumnId, newPosition }) => {
      await queryClient.cancelQueries({ queryKey: ["project-cards", boardId] });
      
      const previousCards = queryClient.getQueryData<ProjectCard[]>(["project-cards", boardId]);
      
      if (previousCards) {
        const updatedCards = previousCards.map((card) =>
          card.id === cardId
            ? { ...card, column_id: newColumnId, position: newPosition }
            : card
        );
        queryClient.setQueryData(["project-cards", boardId], updatedCards);
      }
      
      return { previousCards };
    },
    onError: (_, variables, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(["project-cards", variables.boardId], context.previousCards);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.boardId] });
    },
  });
}

export function useDeleteProjectCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, board_id }: { id: string; board_id: string }) => {
      const { error } = await supabase
        .from("project_cards")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
      toast({ title: "Card excluído!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir card",
        description: error.message,
      });
    },
  });
}

// Card Assignees
export function useAddCardAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      card_id,
      user_id,
      board_id,
    }: {
      card_id: string;
      user_id: string;
      board_id: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("project_card_assignees")
        .insert({
          card_id,
          user_id,
          assigned_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ["project-card", variables.card_id] });
    },
  });
}

export function useRemoveCardAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      card_id,
      user_id,
      board_id,
    }: {
      card_id: string;
      user_id: string;
      board_id: string;
    }) => {
      const { error } = await supabase
        .from("project_card_assignees")
        .delete()
        .eq("card_id", card_id)
        .eq("user_id", user_id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-cards", variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ["project-card", variables.card_id] });
    },
  });
}
