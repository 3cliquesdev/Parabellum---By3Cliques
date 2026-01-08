import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FormBoardIntegration {
  id: string;
  form_id: string;
  board_id: string;
  target_column_id: string | null;
  auto_assign_user_id: string | null;
  send_confirmation_email: boolean;
  confirmation_email_template_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  form?: {
    id: string;
    name: string;
  };
  board?: {
    id: string;
    name: string;
  };
  target_column?: {
    id: string;
    name: string;
  };
  auto_assign_user?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  confirmation_template?: {
    id: string;
    name: string;
  };
}

export function useFormBoardIntegrations() {
  return useQuery({
    queryKey: ["form-board-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_board_integrations")
        .select(`
          *,
          form:forms(id, name),
          board:project_boards(id, name),
          target_column:project_columns(id, name),
          auto_assign_user:profiles(id, first_name, last_name),
          confirmation_template:email_templates(id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as FormBoardIntegration[];
    },
  });
}

export function useFormBoardIntegration(id: string | undefined) {
  return useQuery({
    queryKey: ["form-board-integrations", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("form_board_integrations")
        .select(`
          *,
          form:forms(id, name),
          board:project_boards(id, name),
          target_column:project_columns(id, name),
          auto_assign_user:profiles(id, first_name, last_name),
          confirmation_template:email_templates(id, name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as FormBoardIntegration;
    },
    enabled: !!id,
  });
}

export function useCreateFormBoardIntegration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      form_id: string;
      board_id: string;
      target_column_id?: string | null;
      auto_assign_user_id?: string | null;
      send_confirmation_email?: boolean;
      confirmation_email_template_id?: string | null;
      is_active?: boolean;
    }) => {
      const { data: integration, error } = await supabase
        .from("form_board_integrations")
        .insert({
          form_id: data.form_id,
          board_id: data.board_id,
          target_column_id: data.target_column_id || null,
          auto_assign_user_id: data.auto_assign_user_id || null,
          send_confirmation_email: data.send_confirmation_email ?? true,
          confirmation_email_template_id: data.confirmation_email_template_id || null,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return integration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-board-integrations"] });
      toast({ title: "Integração criada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar integração",
        description: error.message,
      });
    },
  });
}

export function useUpdateFormBoardIntegration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      form_id?: string;
      board_id?: string;
      target_column_id?: string | null;
      auto_assign_user_id?: string | null;
      send_confirmation_email?: boolean;
      confirmation_email_template_id?: string | null;
      is_active?: boolean;
    }) => {
      const { data: integration, error } = await supabase
        .from("form_board_integrations")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return integration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-board-integrations"] });
      toast({ title: "Integração atualizada!" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar integração",
        description: error.message,
      });
    },
  });
}

export function useDeleteFormBoardIntegration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("form_board_integrations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-board-integrations"] });
      toast({ title: "Integração excluída!" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir integração",
        description: error.message,
      });
    },
  });
}
