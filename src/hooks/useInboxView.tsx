import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartmentsByRole, hasFullInboxAccess } from "@/hooks/useDepartmentsByRole";
import type { DateRange } from "react-day-picker";

export interface InboxViewItem {
  conversation_id: string;
  contact_id: string;
  contact_name: string | null;
  contact_avatar: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  last_message_at: string;
  last_snippet: string | null;
  last_channel: string | null;
  last_sender_type: string | null;
  unread_count: number;
  channels: string[];
  has_audio: boolean;
  has_attachments: boolean;
  status: string;
  ai_mode: string;
  assigned_to: string | null;
  department: string | null;
  sla_status: string;
  created_at: string;
  updated_at: string;
}

export interface InboxFilters {
  dateRange?: DateRange;
  channels: string[];
  status: string[];
  assignedTo?: string;
  search: string;
  slaStatus?: 'ok' | 'warning' | 'critical';
  hasAudio?: boolean;
  hasAttachments?: boolean;
  aiMode?: 'autopilot' | 'copilot' | 'disabled';
  department?: string;
  tagId?: string;
}

const QUERY_KEY = ["inbox-view"];

interface FetchOptions {
  cursor?: string;
  userId?: string;
  role?: string | null;
  departmentIds?: string[] | null;
}

// Função para buscar dados do inbox com filtros de role
async function fetchInboxData(options: FetchOptions = {}): Promise<InboxViewItem[]> {
  const { cursor, userId, role, departmentIds } = options;

  let query = supabase
    .from("inbox_view")
    .select("*")
    .order("updated_at", { ascending: true }) // PRIORIDADE: Conversas mais antigas primeiro (aguardando há mais tempo)
    .limit(5000); // Alinhado com useInboxCounts para consistência nos totais

  // Aplicar filtros de role no nível do banco
  if (role && userId && !hasFullInboxAccess(role)) {
    if (role === "sales_rep" || role === "support_agent" || role === "financial_agent") {
      if (departmentIds && departmentIds.length > 0) {
        // Conversa atribuída ao usuário OU 
        // (não atribuída E do departamento permitido) OU
        // (não atribuída E sem departamento definido - pool geral da IA)
        query = query.or(
          `assigned_to.eq.${userId},and(assigned_to.is.null,department.in.(${departmentIds.join(",")})),and(assigned_to.is.null,department.is.null)`
        );
      } else {
        // Sem departamentos configurados: atribuídas ao usuário OU sem departamento (pool geral)
        query = query.or(
          `assigned_to.eq.${userId},and(assigned_to.is.null,department.is.null)`
        );
      }
    } else if (role === "consultant" || role === "user") {
      // Consultant/User: apenas conversas atribuídas a ele
      query = query.eq("assigned_to", userId);
    }
  }
  // Roles de gestão = sem filtro (ver tudo)

  if (cursor) {
    query = query.gt("updated_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as InboxViewItem[];
}

// Função para aplicar filtros client-side
function applyFilters(items: InboxViewItem[], filters?: InboxFilters): InboxViewItem[] {
  if (!filters) return items;

  let result = [...items];
  
  // IMPORTANTE: Quando há busca ativa, NÃO filtrar por status automaticamente
  // Isso permite encontrar conversas em qualquer estado
  const hasActiveSearch = filters.search && filters.search.trim().length > 0;

  // Date range filter
  if (filters.dateRange?.from) {
    result = result.filter(item => 
      new Date(item.last_message_at) >= filters.dateRange!.from!
    );
  }
  if (filters.dateRange?.to) {
    const endOfDay = new Date(filters.dateRange.to);
    endOfDay.setHours(23, 59, 59, 999);
    result = result.filter(item => 
      new Date(item.last_message_at) <= endOfDay
    );
  }

  // Channel filter
  if (filters.channels.length > 0) {
    result = result.filter(item => 
      item.channels?.some(ch => filters.channels.includes(ch))
    );
  }

  // Status filter - SE o usuário selecionou status específico, aplicar
  // SE há busca ativa, mostrar todas (não filtrar por status)
  // SE não há busca e não há status selecionado, ocultar fechadas
  if (filters.status.length > 0) {
    result = result.filter(item => filters.status.includes(item.status));
  } else if (!hasActiveSearch) {
    // Padrão: mostrar apenas conversas NÃO fechadas (open, pending, etc.)
    result = result.filter(item => item.status !== 'closed');
  }
  // Se hasActiveSearch && status.length === 0 → não filtra por status

  // Assigned to filter
  if (filters.assignedTo) {
    if (filters.assignedTo === "unassigned") {
      result = result.filter(item => !item.assigned_to);
    } else {
      result = result.filter(item => item.assigned_to === filters.assignedTo);
    }
  }

  // SLA status filter
  if (filters.slaStatus) {
    result = result.filter(item => item.sla_status === filters.slaStatus);
  }

  // Has audio filter
  if (filters.hasAudio) {
    result = result.filter(item => item.has_audio);
  }

  // Has attachments filter
  if (filters.hasAttachments) {
    result = result.filter(item => item.has_attachments);
  }

  // AI mode filter
  if (filters.aiMode) {
    result = result.filter(item => item.ai_mode === filters.aiMode);
  }

  // Department filter
  if (filters.department) {
    result = result.filter(item => item.department === filters.department);
  }

  // Search filter - case-insensitive em todos os campos
  if (hasActiveSearch) {
    const searchLower = filters.search!.toLowerCase().trim();
    result = result.filter(item => 
      item.contact_name?.toLowerCase().includes(searchLower) ||
      item.contact_email?.toLowerCase().includes(searchLower) ||
      item.contact_phone?.toLowerCase().includes(searchLower) ||
      item.conversation_id.toLowerCase().includes(searchLower) ||
      item.last_snippet?.toLowerCase().includes(searchLower)
    );
  }

  return result;
}

// Função para fazer merge incremental por conversation_id
function mergeInboxItems(existing: InboxViewItem[], incoming: InboxViewItem[]): InboxViewItem[] {
  const map = new Map(existing.map(item => [item.conversation_id, item]));
  
  for (const item of incoming) {
    map.set(item.conversation_id, { ...map.get(item.conversation_id), ...item });
  }
  
  // Ordenar por updated_at ASC (mais antigas primeiro = maior prioridade)
  return Array.from(map.values()).sort((a, b) => 
    new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  );
}

function sortInboxItemsByPriority(items: InboxViewItem[]): InboxViewItem[] {
  // Never mutate input array (critical for React Query cache + react-window stability)
  // PRIORIDADE: Conversas mais antigas no topo (aguardando há mais tempo)
  return [...items].sort((a, b) =>
    new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  );
}

export function useInboxView(filters?: InboxFilters) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { departmentIds, isLoading: deptLoading } = useDepartmentsByRole(role);
  const queryClient = useQueryClient();
  const lastSeenRef = useRef<string | null>(null);
  
  // Refs estáveis para evitar resubscrição do realtime a cada render
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const roleRef = useRef(role);
  roleRef.current = role;
  const departmentIdsRef = useRef(departmentIds);
  departmentIdsRef.current = departmentIds;

  // Memoizar opções de fetch para evitar recriações desnecessárias
  const fetchOptions = useMemo(() => ({
    userId: user?.id,
    role,
    departmentIds,
  }), [user?.id, role, departmentIds]);

  // Ref estável para fetchOptions (usado no realtime)
  const fetchOptionsRef = useRef(fetchOptions);
  fetchOptionsRef.current = fetchOptions;

  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id, role, departmentIds, filters],
    queryFn: async () => {
      const data = await fetchInboxData(fetchOptions);
      
      // Atualizar cursor com o registro mais recente.
      // IMPORTANTE: como a query está ordenada ASC (mais antigas primeiro), o mais recente é o ÚLTIMO.
      if (data.length > 0) {
        lastSeenRef.current = data[data.length - 1].updated_at;
      }

      // Aplicar filtros de tag (requer lookup separado)
      let result = data;
      if (filters?.tagId) {
        const { data: taggedConversations } = await supabase
          .from("conversation_tags")
          .select("conversation_id")
          .eq("tag_id", filters.tagId);
        
        const taggedIds = new Set(taggedConversations?.map(tc => tc.conversation_id) || []);
        result = result.filter(item => taggedIds.has(item.conversation_id));
      }

      // Aplicar filtros client-side
      return applyFilters(result, filters);
    },
    staleTime: 1000, // Reduzido de 5000ms para 1000ms para maior responsividade
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 60000, // Polling backup: 60s - realtime já cobre atualizações instantâneas
    refetchIntervalInBackground: true, // Continuar polling mesmo em background
    enabled: !!user && !roleLoading && !deptLoading,
  });

  // Realtime subscription com merge incremental e catch-up
  // CORRIGIDO: Dependências estáveis para evitar resubscrição excessiva
  useEffect(() => {
    if (!user?.id) return;
    
    console.log("[Realtime] Setting up inbox_view + messages + conversations subscription...");
    
    // Canal 1: inbox_view para status, assignment, etc
    const inboxChannel = supabase
      .channel("inbox-view-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_view",
        },
        (payload) => {
          console.log("[Realtime] inbox_view change:", payload.eventType);
          
          const row = (payload.new || payload.old) as InboxViewItem;
          if (!row?.conversation_id) return;

          // Usar refs para valores atuais (sem recriar canal)
          const currentRole = roleRef.current;
          const currentDeptIds = departmentIdsRef.current;
          const currentFilters = filtersRef.current;

          // Verificar se a conversa deve ser visível para este role/departamento
          // Incluir conversas sem departamento (pool geral) para roles operacionais
          const isInAllowedDepartment = currentDeptIds?.includes(row.department || "") || row.department === null;
          const shouldShow = hasFullInboxAccess(currentRole) || 
            row.assigned_to === user?.id ||
            (row.assigned_to === null && isInAllowedDepartment);

          // Merge incremental no cache
          queryClient.setQueryData<InboxViewItem[]>(
            [...QUERY_KEY, user?.id, currentRole, currentDeptIds, currentFilters],
            (prev = []) => {
              if (payload.eventType === "DELETE" || !shouldShow) {
                return prev.filter(item => item.conversation_id !== row.conversation_id);
              }
              return mergeInboxItems(prev, [row as InboxViewItem]);
            }
          );

          // Invalidar counts para atualizar badges do sidebar
          queryClient.invalidateQueries({ queryKey: ["inbox-counts"], exact: false });

          // Atualizar cursor
          if (row.updated_at && (!lastSeenRef.current || row.updated_at > lastSeenRef.current)) {
            lastSeenRef.current = row.updated_at;
          }
        }
      )
      .subscribe(async (status) => {
        console.log("[Realtime] inbox_view subscription status:", status);
        
        // Catch-up ao reconectar
        if (status === "SUBSCRIBED" && lastSeenRef.current) {
          console.log("[Realtime] Running catch-up from cursor:", lastSeenRef.current);
          try {
            const catchUpData = await fetchInboxData({ 
              cursor: lastSeenRef.current,
              ...fetchOptionsRef.current 
            });
            if (catchUpData.length > 0) {
              console.log("[Realtime] Catch-up found", catchUpData.length, "new records");
              const currentFilters = filtersRef.current;
              queryClient.setQueryData<InboxViewItem[]>(
                [...QUERY_KEY, user?.id, roleRef.current, departmentIdsRef.current, currentFilters],
                (prev = []) => mergeInboxItems(prev, catchUpData)
              );
              // catchUpData vem ordenado ASC; último é o mais recente
              lastSeenRef.current = catchUpData[catchUpData.length - 1].updated_at;
            }
          } catch (error) {
            console.error("[Realtime] Catch-up failed:", error);
          }
        }
      });

    // 🆕 Canal 2: messages GLOBAL para atualizar snippet e unread_count de TODAS as conversas
    // IMPORTANTE: Isso NÃO duplica mensagens no chat - apenas atualiza o preview na sidebar
    // O useMessages.tsx cuida das mensagens na conversa ATIVA
    const messagesChannel = supabase
      .channel("inbox-messages-global-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as any;
          if (!newMessage?.conversation_id) return;
          
          console.log("[Realtime] 📩 Nova mensagem global:", newMessage.id?.slice(0, 8), "conv:", newMessage.conversation_id?.slice(0, 8));
          
          // Atualizar snippet inline em TODAS as query keys de inbox-view
          queryClient.setQueriesData<InboxViewItem[]>(
            { queryKey: ["inbox-view"], exact: false },
            (prev = []) => {
              const updated = prev.map(item => 
                item.conversation_id === newMessage.conversation_id 
                  ? { 
                      ...item, 
                      last_snippet: newMessage.content?.slice(0, 100) || '',
                      last_message_at: newMessage.created_at,
                      last_sender_type: newMessage.sender_type,
                      last_channel: newMessage.channel || 'web_chat',
                      // Incrementar unread_count APENAS para mensagens de clientes
                      unread_count: newMessage.sender_type === 'contact' 
                        ? (item.unread_count || 0) + 1 
                        : item.unread_count,
                      updated_at: newMessage.created_at,
                    } 
                  : item
              );
              return sortInboxItemsByPriority(updated);
            }
          );
          
          // Invalidar counts para atualizar badges
          queryClient.invalidateQueries({ queryKey: ["inbox-counts"], exact: false });
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] messages global subscription status:", status);
      });

    // 🆕 Canal 3: conversations para detectar NOVAS conversas imediatamente
    const conversationsChannel = supabase
      .channel("inbox-conversations-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
        },
        async (payload) => {
          const newConv = payload.new as any;
          if (!newConv?.id) return;
          
          console.log("[Realtime] NOVA conversa detectada:", newConv.id);
          
          // Fazer refetch para obter dados completos da inbox_view
          // O invalidateQueries forçará um refetch automático
          queryClient.invalidateQueries({ queryKey: ["inbox-view"], exact: false });
          queryClient.invalidateQueries({ queryKey: ["inbox-counts"], exact: false });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        async (payload) => {
          const updatedConv = payload.new as any;
          if (!updatedConv?.id) return;
          
          console.log("[Realtime] Conversa atualizada:", updatedConv.id, {
            status: updatedConv.status,
            ai_mode: updatedConv.ai_mode,
            assigned_to: updatedConv.assigned_to?.slice(0, 8)
          });
          
          // Atualizar campos críticos inline no cache (sem refetch)
          queryClient.setQueriesData<InboxViewItem[]>(
            { queryKey: ["inbox-view"], exact: false },
            (prev = []) => {
              const updated = prev.map(item => 
                item.conversation_id === updatedConv.id 
                  ? { 
                      ...item, 
                      status: updatedConv.status,
                      ai_mode: updatedConv.ai_mode,
                      assigned_to: updatedConv.assigned_to,
                      department: updatedConv.department,
                      updated_at: updatedConv.last_message_at || new Date().toISOString(),
                    } 
                  : item
              );
              return sortInboxItemsByPriority(updated);
            }
          );

          // Invalidar counts para atualizar badges do sidebar
          queryClient.invalidateQueries({ queryKey: ["inbox-counts"], exact: false });
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] conversations subscription status:", status);
      });

    return () => {
      console.log("[Realtime] Removing inbox_view + messages + conversations channels");
      supabase.removeChannel(inboxChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [queryClient, user?.id]); // APENAS user?.id como dependência - refs mantêm valores atuais

  // Visibility change listener - refetch quando aba volta ao foco
  // CORRIGIDO: Usar refs para evitar resubscrição excessiva
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && lastSeenRef.current) {
        console.log("[Visibility] Tab became visible, running catch-up...");
        fetchInboxData({ cursor: lastSeenRef.current, ...fetchOptionsRef.current }).then(data => {
          if (data.length > 0) {
            queryClient.setQueryData<InboxViewItem[]>(
              [...QUERY_KEY, user?.id, roleRef.current, departmentIdsRef.current, filtersRef.current],
              (prev = []) => mergeInboxItems(prev, data)
            );
            lastSeenRef.current = data[0].updated_at;
          }
        }).catch(console.error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [queryClient, user?.id]); // APENAS user?.id como dependência

  // Função para resetar unread count ao abrir conversa
  // CORRIGIDO: Usar refs para evitar recriação desnecessária
  const resetUnreadCount = useCallback(async (conversationId: string) => {
    try {
      await supabase.rpc("reset_inbox_unread_count", {
        p_conversation_id: conversationId,
      });
      // Atualização otimista no cache usando refs
      queryClient.setQueryData<InboxViewItem[]>(
        [...QUERY_KEY, user?.id, roleRef.current, departmentIdsRef.current, filtersRef.current],
        (prev = []) => prev.map(item => 
          item.conversation_id === conversationId 
            ? { ...item, unread_count: 0 } 
            : item
        )
      );
    } catch (error) {
      console.error("Failed to reset unread count:", error);
    }
  }, [queryClient, user?.id]);

  return {
    ...query,
    resetUnreadCount,
  };
}

// Hook para contagem por filtros (para badges) - Estilo Octa
export interface InboxCounts {
  total: number;
  mine: number;
  aiQueue: number;
  humanQueue: number;
  slaCritical: number;
  slaWarning: number;
  notResponded: number;
  myNotResponded: number; // Conversas do usuário atual aguardando resposta
  unassigned: number;
  unread: number;
  closed: number;
  byDepartment: Array<{ id: string; name: string; color: string | null; count: number }>;
  byTag: Array<{ id: string; name: string; color: string | null; count: number }>;
}

export function useInboxCounts(userId?: string) {
  const { role, loading: roleLoading } = useUserRole();
  const { departmentIds, isLoading: deptLoading } = useDepartmentsByRole(role);

  // IMPORTANTE: Só executar a query quando o role estiver REALMENTE carregado
  // Para evitar que admin veja dados filtrados como "user"
  const isRoleReady = !roleLoading && role !== null && role !== undefined;
  
  // Usar o role real quando disponível (null = sem filtro de role)
  const effectiveRole = isRoleReady ? role : null;

  return useQuery<InboxCounts>({
    queryKey: ["inbox-counts", userId, effectiveRole, departmentIds],
    // CRITICAL: Só rodar quando role estiver DEFINITIVAMENTE resolvido
    enabled: !!userId && isRoleReady && !deptLoading,
    queryFn: async (): Promise<InboxCounts> => {
      // ✅ Contagens via backend function (bypass de RLS) para evitar discrepâncias.
      const { data, error } = await supabase.functions.invoke("get-inbox-counts");
      if (error) throw error;
      return (data?.counts || {
        total: 0,
        mine: 0,
        aiQueue: 0,
        humanQueue: 0,
        slaCritical: 0,
        slaWarning: 0,
        notResponded: 0,
        myNotResponded: 0,
        unassigned: 0,
        unread: 0,
        closed: 0,
        byDepartment: [],
        byTag: [],
      }) as InboxCounts;
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 3000),
    placeholderData: {
      total: 0,
      mine: 0,
      aiQueue: 0,
      humanQueue: 0,
      slaCritical: 0,
      slaWarning: 0,
      notResponded: 0,
      myNotResponded: 0,
      unassigned: 0,
      unread: 0,
      closed: 0,
      byDepartment: [],
      byTag: [],
    },
  });
}
