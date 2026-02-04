import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartmentsByRole, hasFullInboxAccess } from "@/hooks/useDepartmentsByRole";
import type { Tables } from "@/integrations/supabase/types";
import type { DateRange } from "react-day-picker";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact | null;
  department_data?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
    department: string | null;
  } | null;
};

export interface ConversationFilters {
  dateRange?: DateRange;
  channels: string[];
  status: string[];
  assignedTo?: string;
  tags: string[];
  search: string;
  slaExpired: boolean;
}

const SLA_HOURS = 4; // Configurable SLA threshold

export function useConversations(filters?: ConversationFilters) {
  const { user, department: userDepartmentId } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const { departmentIds, isLoading: deptLoading } = useDepartmentsByRole(role, userDepartmentId);

  // Refs estáveis para evitar resubscrição do realtime a cada render
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const roleRef = useRef(role);
  roleRef.current = role;

  // Realtime subscription for conversations - otimizado para máxima velocidade
  // CORRIGIDO: Usar refs para evitar resubscrição excessiva
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel("conversations-realtime-v2")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
        },
        async (payload) => {
          console.log("[Realtime] 🆕 New conversation INSERT:", payload.new.id);
          
          // Fetch completo com joins para adicionar imediatamente na lista
          const { data: newConv, error } = await supabase
            .from("conversations")
            .select(`
              *,
              contacts(*, organizations(*)),
              department_data:departments!department(id, name, color),
              assigned_user:profiles!assigned_to(id, full_name, avatar_url, job_title, department)
            `)
            .eq('id', payload.new.id)
            .single();
          
          if (newConv && !error) {
            // Adicionar diretamente ao cache sem invalidar (mais rápido)
            // Usar refs para valores atuais
            queryClient.setQueryData(
              ["conversations", user?.id, roleRef.current, filtersRef.current],
              (old: Conversation[] | undefined) => {
                if (!old) return [newConv];
                // Verificar se já existe para evitar duplicação
                if (old.some(c => c.id === newConv.id)) return old;
                // Adicionar no topo (mais recente primeiro)
                return [newConv as Conversation, ...old];
              }
            );
            console.log("[Realtime] ✅ Conversation added to cache instantly");
          } else {
            // Fallback: invalidar se fetch falhou
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          console.log("[Realtime] 🔄 Conversation UPDATE:", payload.new.id);
          // Para updates, invalidar para refetch com dados corretos
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          console.log("[Realtime] ❌ Conversation DELETE:", payload.old.id);
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] 📡 Conversations channel status:", status);
        if (status === 'SUBSCRIBED') {
          console.log("[Realtime] ✅ Listening for conversation changes");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]); // APENAS user?.id como dependência - refs mantêm valores atuais

  return useQuery({
    queryKey: ["conversations", user?.id, role, filters],
    queryFn: async () => {
      // IMPORTANTE: Buscar todas as conversas sem limite para refletir contagens corretas
      // O inbox_view já filtra por status, aqui buscamos os dados completos para a lista
      let query = supabase
        .from("conversations")
        .select(`
          *,
          contacts(*, organizations(*)),
          department_data:departments!department(id, name, color),
          assigned_user:profiles!assigned_to(id, full_name, avatar_url, job_title, department)
        `)
        .limit(5000); // Alinhado com useInboxCounts para consistência

      // Role-based filtering por departamento
      if (role && user?.id && !hasFullInboxAccess(role)) {
        // Roles operacionais: ver apenas conversas atribuídas a eles OU não atribuídas do seu departamento OU pool geral (sem departamento)
        if (role === "sales_rep" || role === "support_agent" || role === "financial_agent") {
          if (departmentIds && departmentIds.length > 0) {
            // Conversa atribuída ao usuário OU do departamento (inclui colegas) OU pool geral (sem departamento)
            query = query.or(
              `assigned_to.eq.${user.id},department.in.(${departmentIds.join(",")}),and(assigned_to.is.null,department.is.null)`
            );
          } else {
            // Se não há departamentos configurados, ver atribuídas ao usuário OU pool geral (sem departamento)
            query = query.or(
              `assigned_to.eq.${user.id},and(assigned_to.is.null,department.is.null)`
            );
          }
        } else if (role === "consultant") {
          // Consultant: ver apenas conversas atribuídas a ele
          query = query.eq("assigned_to", user.id);
        } else if (role === "user") {
          // User genérico: ver apenas atribuídas a ele
          query = query.eq("assigned_to", user.id);
        }
      }
      // Roles de gestão (admin, manager, general_manager, support_manager, cs_manager) = ver tudo

      // Apply filters if provided
      if (filters) {
        // Date range filter
        if (filters.dateRange?.from) {
          query = query.gte("created_at", filters.dateRange.from.toISOString());
        }
        if (filters.dateRange?.to) {
          const endOfDay = new Date(filters.dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte("created_at", endOfDay.toISOString());
        }

        // Channel filter
        if (filters.channels.length > 0) {
          query = query.in("channel", filters.channels as ("email" | "web_chat" | "whatsapp")[]);
        }

        // Status filter
        if (filters.status.length > 0) {
          query = query.in("status", filters.status as ("open" | "closed")[]);
        }

        // Assigned to filter
        if (filters.assignedTo) {
          if (filters.assignedTo === "unassigned") {
            query = query.is("assigned_to", null);
          } else {
            query = query.eq("assigned_to", filters.assignedTo);
          }
        }

        // Search filter (name, email, or ID)
        if (filters.search) {
          // We'll filter client-side for contact name/email since it's a joined table
        }
      }

      const { data, error } = await query.order("last_message_at", { ascending: false });

      if (error) throw error;

      let result = data as Conversation[];

      // Client-side filtering for search and SLA expired
      if (filters) {
        // Search filter (applied client-side for joined data)
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          result = result.filter(conv => {
            const contact = conv.contacts;
            if (!contact) return false;
            return (
              contact.first_name?.toLowerCase().includes(searchLower) ||
              contact.last_name?.toLowerCase().includes(searchLower) ||
              contact.email?.toLowerCase().includes(searchLower) ||
              contact.phone?.includes(filters.search) ||
              conv.id.toLowerCase().includes(searchLower)
            );
          });
        }

        // SLA expired filter
        if (filters.slaExpired) {
          const now = new Date();
          const slaThreshold = new Date(now.getTime() - SLA_HOURS * 60 * 60 * 1000);
          result = result.filter(conv => {
            // Only open conversations with no first response yet
            if (conv.status !== "open" || conv.first_response_at) return false;
            const lastMessage = new Date(conv.last_message_at);
            return lastMessage < slaThreshold;
          });
        }
      }

      return result;
    },
    // Reduce stale time for faster updates
    staleTime: 3000, // Reduzido para maior responsividade
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Polling backup: 60s - realtime já cobre atualizações instantâneas
    refetchIntervalInBackground: false, // Não precisa em background com realtime ativo
    enabled: !!user && !roleLoading && !deptLoading,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          contact_id: contactId,
          channel: "whatsapp",
          status: "open",
        })
        .select("*, contacts(*)")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({
        title: "Conversa iniciada",
        description: "Nova conversa criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar conversa",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Helper to check if a conversation has SLA expired
export function isSlaCritical(conversation: Conversation, thresholdHours = SLA_HOURS): boolean {
  if (conversation.status !== "open" || conversation.first_response_at) return false;
  const now = new Date();
  const lastMessage = new Date(conversation.last_message_at);
  const hoursAgo = (now.getTime() - lastMessage.getTime()) / (1000 * 60 * 60);
  return hoursAgo >= thresholdHours;
}
