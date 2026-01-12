import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InstagramAccount {
  id: string;
  instagram_user_id: string;
  username: string;
  access_token: string;
  token_expires_at: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useInstagramAccounts = () => {
  return useQuery({
    queryKey: ["instagram-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InstagramAccount[];
    },
  });
};

export const useActiveInstagramAccount = () => {
  return useQuery({
    queryKey: ["instagram-accounts", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as InstagramAccount | null;
    },
  });
};

export const useConnectInstagram = () => {
  const [isLoading, setIsLoading] = useState(false);

  const startOAuth = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-start-oauth");

      if (error) {
        console.error("Error starting OAuth:", error);
        toast.error("Erro ao iniciar conexão com Instagram");
        return;
      }

      if (data.error) {
        toast.error(data.message || data.error);
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Error starting OAuth:", error);
      toast.error("Erro ao conectar com Instagram");
    } finally {
      setIsLoading(false);
    }
  };

  return { startOAuth, isLoading };
};

export const useDisconnectInstagram = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from("instagram_accounts")
        .update({ is_active: false })
        .eq("id", accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] });
      toast.success("Conta Instagram desconectada");
    },
    onError: (error) => {
      console.error("Error disconnecting Instagram:", error);
      toast.error("Erro ao desconectar conta Instagram");
    },
  });
};

export const useSyncInstagram = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId?: string) => {
      const { data, error } = await supabase.functions.invoke("instagram-sync", {
        body: { account_id: accountId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-posts"] });
      queryClient.invalidateQueries({ queryKey: ["instagram-comments"] });
      toast.success("Sincronização concluída com sucesso");
    },
    onError: (error) => {
      console.error("Error syncing Instagram:", error);
      toast.error("Erro ao sincronizar Instagram");
    },
  });
};
