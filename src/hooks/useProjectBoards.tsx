import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProjectBoard {
  id: string;
  name: string;
  description: string | null;
  deal_id: string | null;
  contact_id: string | null;
  organization_id: string | null;
  template_id: string | null;
  created_by: string | null;
  status: "active" | "archived" | "completed";
  due_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    company: string | null;
  };
  organization?: {
    id: string;
    name: string;
  };
  deal?: {
    id: string;
    title: string;
    value: number | null;
  };
  columns_count?: number;
  cards_count?: number;
  completed_cards_count?: number;
}

export interface ProjectBoardTemplate {
  id: string;
  name: string;
  description: string | null;
  columns: Array<{
    name: string;
    color: string;
    position: number;
    is_final?: boolean;
    email_template_id?: string;
    cards?: Array<{ title: string; description?: string }>;
  }>;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
}

export function useProjectBoards(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ["project-boards", filters],
    queryFn: async () => {
      let query = supabase
        .from("project_boards")
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, company),
          organization:organizations(id, name),
          deal:deals(id, title, value)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters?.search) {
        query = query.ilike("name", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProjectBoard[];
    },
  });
}

export function useProjectBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: ["project-board", boardId],
    queryFn: async () => {
      if (!boardId) return null;
      
      const { data, error } = await supabase
        .from("project_boards")
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, company, phone),
          organization:organizations(id, name),
          deal:deals(id, title, value, status)
        `)
        .eq("id", boardId)
        .single();

      if (error) throw error;
      return data as ProjectBoard;
    },
    enabled: !!boardId,
  });
}

export function useProjectBoardTemplates() {
  return useQuery({
    queryKey: ["project-board-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_board_templates")
        .select("*")
        .order("is_default", { ascending: false });

      if (error) throw error;
      return (data as unknown as ProjectBoardTemplate[]) ?? [];
    },
  });
}

export function useCreateProjectBoard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      deal_id?: string;
      contact_id?: string;
      organization_id?: string;
      template_id?: string;
      due_date?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create board
      const { data: board, error: boardError } = await supabase
        .from("project_boards")
        .insert({
          ...data,
          created_by: user.id,
        })
        .select()
        .single();

      if (boardError) throw boardError;

      // If template is provided, create columns and cards from it
      if (data.template_id) {
        const { data: template } = await supabase
          .from("project_board_templates")
          .select("columns")
          .eq("id", data.template_id)
          .single();

        if (template?.columns) {
          const columns = template.columns as ProjectBoardTemplate["columns"];
          
          for (const col of columns) {
            const { data: column, error: colError } = await supabase
              .from("project_columns")
              .insert({
                board_id: board.id,
                name: col.name,
                color: col.color,
                position: col.position,
                is_final: col.is_final || false,
              })
              .select()
              .single();

            if (colError) continue;

            // Create initial cards
            if (col.cards?.length) {
              for (let i = 0; i < col.cards.length; i++) {
                const card = col.cards[i];
                await supabase.from("project_cards").insert({
                  board_id: board.id,
                  column_id: column.id,
                  title: card.title,
                  description: card.description || null,
                  position: i,
                  created_by: user.id,
                });
              }
            }
          }
        }
      }

      return board;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-boards"] });
      toast({ title: "Projeto criado com sucesso!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar projeto",
        description: error.message,
      });
    },
  });
}

export function useUpdateProjectBoard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string | null;
      status?: "active" | "archived" | "completed";
      due_date?: string | null;
      contact_id?: string | null;
    }) => {
      const { data: board, error } = await supabase
        .from("project_boards")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return board;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-boards"] });
      queryClient.invalidateQueries({ queryKey: ["project-board", variables.id] });
      toast({ title: "Projeto atualizado!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar projeto",
        description: error.message,
      });
    },
  });
}

export function useDeleteProjectBoard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_boards")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-boards"] });
      toast({ title: "Projeto excluído!" });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir projeto",
        description: error.message,
      });
    },
  });
}
