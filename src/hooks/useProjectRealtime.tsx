import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProjectRealtime(boardId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!boardId) return;

    // Subscribe to card changes
    const cardsChannel = supabase
      .channel(`project-cards-${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_cards",
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-cards", boardId] });
        }
      )
      .subscribe();

    // Subscribe to column changes
    const columnsChannel = supabase
      .channel(`project-columns-${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_columns",
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-columns", boardId] });
        }
      )
      .subscribe();

    // Subscribe to assignee changes
    const assigneesChannel = supabase
      .channel(`project-assignees-${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_card_assignees",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-cards", boardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cardsChannel);
      supabase.removeChannel(columnsChannel);
      supabase.removeChannel(assigneesChannel);
    };
  }, [boardId, queryClient]);
}

export function useCardCommentsRealtime(cardId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!cardId) return;

    const channel = supabase
      .channel(`project-comments-${cardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_card_comments",
          filter: `card_id=eq.${cardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["project-comments", cardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cardId, queryClient]);
}
