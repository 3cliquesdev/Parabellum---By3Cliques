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
  whatsapp_instance_id: string | null;
  whatsapp_meta_instance_id: string | null;
  whatsapp_provider: string | null;
  contact_whatsapp_id: string | null;
  department_name: string | null;
  department_color: string | null;
  assigned_agent_name: string | null;
  assigned_agent_avatar: string | null;
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
  aiMode?: 'autopilot' | 'copilot' | 'disabled' | 'waiting_human' | 'ai_all' | 'ai_only';
  department?: string;
  tags?: string[];
}

export type InboxScope = 'active' | 'archived';

const QUERY_KEY = ["inbox-view"];

interface FetchOptions {
  cursor?: string;
  userId?: string;
  role?: string | null;
  departmentIds?: string[] | null;
  scope?: InboxScope;
  aiMode?: string;
  dateRange?: DateRange;
  channels?: string[];
  department?: string;
  assignedTo?: string;
  tags?: string[];
}

// Função para buscar dados do inbox com filtros de role
async function fetchInboxData(options: FetchOptions = {}): Promise<InboxViewItem[]> {
  const { cursor, userId, role, departmentIds, scope = 'active', aiMode, dateRange, channels, department, assignedTo, tags } = options;

  let query = supabase
    .from("inbox_view")
    .select("*");

  // ✅ FIX: Scope determina se busca ativas ou arquivadas
  if (scope === 'archived') {
    query = query.eq("status", "closed");
  } else {
    query = query.neq("status", "closed");
  }

  // ✅ Aplicar filtro de AI mode no nível do banco para archived (evita perder dados no limit)
  if (scope === 'archived' && aiMode) {
    if (aiMode === 'ai_only') {
      query = query.eq("ai_mode", "autopilot").is("assigned_to", null);
    } else if (aiMode === 'ai_all') {
      query = query.in("ai_mode", ["autopilot", "copilot", "waiting_human"]);
    } else {
      query = query.eq("ai_mode", aiMode);
    }
  }

  // ✅ Aplicar filtro de dateRange no nível do banco para archived
  if (scope === 'archived' && dateRange) {
    if (dateRange.from) {
      const startOfDay = new Date(dateRange.from);
      startOfDay.setHours(0, 0, 0, 0);
      query = query.gte("last_message_at", startOfDay.toISOString());
    }
    if (dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("last_message_at", endOfDay.toISOString());
    }
  }

  // ✅ Aplicar filtro de channels no nível do banco para archived
  if (scope === 'archived' && channels && channels.length > 0) {
    query = query.overlaps("channels", channels);
  }

  // ✅ Aplicar filtro de department no nível do banco para archived
  if (scope === 'archived' && department) {
    query = query.eq("department", department);
  }

  // ✅ Aplicar filtro de assignedTo no nível do banco para archived
  if (scope === 'archived' && assignedTo) {
    if (assignedTo === 'unassigned') {
      query = query.is("assigned_to", null);
    } else {
      query = query.eq("assigned_to", assignedTo);
    }
  }

  // ✅ Filtro de tags no nível do banco (evita limite de 1000 do client-side)
  // Usa chunking para tags com muitas conversas (evita 400 Bad Request por URL longa)
  if (tags && tags.length > 0) {
    const { data: tagRows } = await supabase
      .from('conversation_tags')
      .select('conversation_id')
      .in('tag_id', tags)
      .limit(5000);

    const tagConvIds = [...new Set(tagRows?.map(r => r.conversation_id) || [])];

    if (tagConvIds.length === 0) {
      console.log(`[InboxView] tag filter returned 0 conversation_ids — returning empty`);
      return [];
    }

    const CHUNK_SIZE = 300;

    if (tagConvIds.length <= CHUNK_SIZE) {
      // Caso simples: poucos IDs, query única
      query = query.in('conversation_id', tagConvIds);
    } else {
      // Chunking: dividir IDs em lotes e executar em paralelo
      console.log(`[InboxView] tag filter has ${tagConvIds.length} IDs — using chunked queries (${CHUNK_SIZE}/chunk)`);

      // Precisamos finalizar a query base aqui e executar chunks manualmente
      // Salvar os filtros já aplicados na query e recriar para cada chunk
      const chunks: string[][] = [];
      for (let i = 0; i < tagConvIds.length; i += CHUNK_SIZE) {
        chunks.push(tagConvIds.slice(i, i + CHUNK_SIZE));
      }

      // Executar todas as queries em paralelo
      const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
          // Reconstruir query com os mesmos filtros para cada chunk
          let chunkQuery = supabase.from("inbox_view").select("*");

          if (scope === 'archived') {
            chunkQuery = chunkQuery.eq("status", "closed");
          } else {
            chunkQuery = chunkQuery.neq("status", "closed");
          }

          if (scope === 'archived' && aiMode) {
            if (aiMode === 'ai_only') {
              chunkQuery = chunkQuery.eq("ai_mode", "autopilot").is("assigned_to", null);
            } else if (aiMode === 'ai_all') {
              chunkQuery = chunkQuery.in("ai_mode", ["autopilot", "copilot", "waiting_human"]);
            } else {
              chunkQuery = chunkQuery.eq("ai_mode", aiMode);
            }
          }

          if (scope === 'archived' && dateRange) {
            if (dateRange.from) {
              const startOfDay = new Date(dateRange.from);
              startOfDay.setHours(0, 0, 0, 0);
              chunkQuery = chunkQuery.gte("last_message_at", startOfDay.toISOString());
            }
            if (dateRange.to) {
              const endOfDay = new Date(dateRange.to);
              endOfDay.setHours(23, 59, 59, 999);
              chunkQuery = chunkQuery.lte("last_message_at", endOfDay.toISOString());
            }
          }

          if (scope === 'archived' && channels && channels.length > 0) {
            chunkQuery = chunkQuery.overlaps("channels", channels);
          }

          if (scope === 'archived' && department) {
            chunkQuery = chunkQuery.eq("department", department);
          }

          if (scope === 'archived' && assignedTo) {
            if (assignedTo === 'unassigned') {
              chunkQuery = chunkQuery.is("assigned_to", null);
            } else {
              chunkQuery = chunkQuery.eq("assigned_to", assignedTo);
            }
          }

          chunkQuery = chunkQuery.in('conversation_id', chunk);

          if (role && userId && !hasFullInboxAccess(role)) {
            if (role === "sales_rep" || role === "support_agent" || role === "financial_agent") {
              if (departmentIds && departmentIds.length > 0) {
                chunkQuery = chunkQuery.or(
                  `assigned_to.eq.${userId},department.in.(${departmentIds.join(",")}),and(assigned_to.is.null,department.is.null)`
                );
              } else {
                chunkQuery = chunkQuery.or(
                  `assigned_to.eq.${userId},and(assigned_to.is.null,department.is.null)`
                );
              }
            } else if (role === "consultant" || role === "user") {
              chunkQuery = chunkQuery.eq("assigned_to", userId);
            }
          }

          const isArchivedScope = scope === 'archived';
          chunkQuery = chunkQuery
            .order("updated_at", { ascending: !isArchivedScope })
            .limit(isArchivedScope ? 1000 : 500);

          const { data, error } = await chunkQuery;
          if (error) throw error;
          return (data || []) as InboxViewItem[];
        })
      );

      // Mergear e deduplicar por conversation_id
      const seen = new Map<string, InboxViewItem>();
      for (const rows of chunkResults) {
        for (const row of rows) {
          seen.set(row.conversation_id, row);
        }
      }

      const merged = Array.from(seen.values());
      const isArchivedScope = scope === 'archived';
      merged.sort((a, b) => {
        const diff = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        return isArchivedScope ? -diff : diff;
      });

      console.log(`[InboxView] chunked tag query: ${chunks.length} chunks, ${merged.length} unique results`);

      // Retornar diretamente — pular o resto da função
      return merged.slice(0, isArchivedScope ? 1000 : 500);
    }
  }

  const isArchivedScope = scope === 'archived';
  query = query
    .order("updated_at", { ascending: !isArchivedScope })
    .limit(isArchivedScope ? 1000 : 500);

  // Aplicar filtros de role no nível do banco
  if (role && userId && !hasFullInboxAccess(role)) {
    if (role === "sales_rep" || role === "support_agent" || role === "financial_agent") {
      if (departmentIds && departmentIds.length > 0) {
        query = query.or(
          `assigned_to.eq.${userId},department.in.(${departmentIds.join(",")}),and(assigned_to.is.null,department.is.null)`
        );
      } else {
        query = query.or(
          `assigned_to.eq.${userId},and(assigned_to.is.null,department.is.null)`
        );
      }
    } else if (role === "consultant" || role === "user") {
      query = query.eq("assigned_to", userId);
    }
  }

  if (cursor) {
    query = query.gt("updated_at", cursor);
  }

  const { data, error } = await query;

  if (scope === 'archived') {
    console.log(`[InboxView] archived query | aiMode=${aiMode ?? 'none'} | dateRange=${dateRange?.from?.toISOString() ?? '-'}→${dateRange?.to?.toISOString() ?? '-'} | channels=${channels?.join(',') ?? 'all'} | dept=${department ?? 'all'} | assignedTo=${assignedTo ?? 'all'} | results=${data?.length ?? 0}`);
  }

  if (error) throw error;
  return (data || []) as InboxViewItem[];
}

// Função para aplicar filtros client-side (PURAMENTE SÍNCRONA)
function applyFilters(items: InboxViewItem[], filters?: InboxFilters, _tagIdsSet?: Set<string>, scope?: 'active' | 'archived'): InboxViewItem[] {
  if (!filters) return items;

  let result = [...items];
  
  const hasActiveSearch = filters.search && filters.search.trim().length > 0;

  // Date range filter — skip for archived (already filtered at DB level)
  if (scope !== 'archived') {
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
  }

  // Channel filter — skip for archived (already filtered at DB level)
  if (scope !== 'archived' && filters.channels.length > 0) {
    result = result.filter(item => 
      item.channels?.some(ch => filters.channels.includes(ch))
    );
  }

  // Status filter — skip default exclusion for archived scope (all items are closed)
  if (filters.status.length > 0) {
    result = result.filter(item => filters.status.includes(item.status));
  } else if (!hasActiveSearch && scope !== 'archived') {
    result = result.filter(item => item.status !== 'closed');
  }

  // Assigned to filter — skip for archived (already filtered at DB level)
  if (scope !== 'archived' && filters.assignedTo) {
    if (filters.assignedTo === "unassigned") {
      result = result.filter(item => !item.assigned_to);
    } else {
      result = result.filter(item => item.assigned_to === filters.assignedTo);
    }
  }

  // SLA status filter
  if (filters.slaStatus) {
    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    
    result = result.filter(item => {
      if (item.status === 'closed') return false;
      if (item.last_sender_type !== 'contact') return false;
      
      const lastMsg = new Date(item.last_message_at).getTime();
      const elapsed = now - lastMsg;
      
      if (filters.slaStatus === 'critical') {
        return elapsed >= FOUR_HOURS_MS;
      }
      if (filters.slaStatus === 'warning') {
        return elapsed >= ONE_HOUR_MS && elapsed < FOUR_HOURS_MS;
      }
      return true;
    });
  }

  // Has audio filter
  if (filters.hasAudio) {
    result = result.filter(item => item.has_audio);
  }

  // Has attachments filter
  if (filters.hasAttachments) {
    result = result.filter(item => item.has_attachments);
  }

  // AI mode filter — skip for archived (already filtered at DB level)
  if (scope !== 'archived' && filters.aiMode) {
    if (filters.aiMode === 'ai_all') {
      result = result.filter(item => ['autopilot', 'copilot', 'waiting_human'].includes(item.ai_mode));
    } else if (filters.aiMode === 'ai_only') {
      result = result.filter(item => item.ai_mode === 'autopilot' && !item.assigned_to);
    } else {
      result = result.filter(item => item.ai_mode === filters.aiMode);
    }
  }

  // Department filter — skip for archived (already filtered at DB level)
  if (scope !== 'archived' && filters.department) {
    result = result.filter(item => item.department === filters.department);
  }

  // Tag filter — now handled at DB level in fetchInboxData (removed client-side)

  // Search filter
  if (hasActiveSearch) {
    const searchLower = filters.search!.toLowerCase().trim();
    result = result.filter(item => 
      item.contact_name?.toLowerCase().includes(searchLower) ||
      item.contact_email?.toLowerCase().includes(searchLower) ||
      item.contact_phone?.toLowerCase().includes(searchLower) ||
      item.contact_id?.toLowerCase().includes(searchLower) ||
      item.conversation_id.toLowerCase().includes(searchLower) ||
      item.last_snippet?.toLowerCase().includes(searchLower)
    );
  }

  return result;
}

// useTagConversationIds removed — tag filtering now happens at DB level in fetchInboxData

// Função para fazer merge incremental por conversation_id
function mergeInboxItems(existing: InboxViewItem[], incoming: InboxViewItem[]): InboxViewItem[] {
  const map = new Map(existing.map(item => [item.conversation_id, item]));
  
  for (const item of incoming) {
    map.set(item.conversation_id, { ...map.get(item.conversation_id), ...item });
  }
  
  return Array.from(map.values()).sort((a, b) => 
    new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  );
}

function sortInboxItemsByPriority(items: InboxViewItem[]): InboxViewItem[] {
  return [...items].sort((a, b) =>
    new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  );
}

export function useInboxView(filters?: InboxFilters, scope: InboxScope = 'active') {
  const { user, department: userDepartmentId } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { departmentIds, isLoading: deptLoading } = useDepartmentsByRole(role, userDepartmentId);
  const queryClient = useQueryClient();
  const lastSeenRef = useRef<string | null>(null);
  
  // Refs estáveis para evitar resubscrição do realtime a cada render
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const roleRef = useRef(role);
  roleRef.current = role;
  const departmentIdsRef = useRef(departmentIds);
  departmentIdsRef.current = departmentIds;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const deptKey = useMemo(() => 
    departmentIds ? [...departmentIds].sort().join(',') : 'all',
    [departmentIds]
  );

  // Refs para uso no realtime (sem resubscrição)
  const deptKeyRef = useRef(deptKey);
  deptKeyRef.current = deptKey;

  // Memoizar opções de fetch
  const archivedFilters = scope === 'archived' ? {
    aiMode: filters?.aiMode,
    dateRange: filters?.dateRange,
    channels: filters?.channels,
    department: filters?.department,
    assignedTo: filters?.assignedTo,
  } : {};

  const tagsKey = filters?.tags && filters.tags.length > 0 ? [...filters.tags].sort().join(',') : undefined;

  const fetchOptions = useMemo(() => ({
    userId: user?.id,
    role,
    departmentIds,
    scope,
    tags: filters?.tags,
    ...archivedFilters,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user?.id, role, departmentIds, scope, filters?.aiMode, filters?.dateRange, filters?.channels?.join(','), filters?.department, filters?.assignedTo, tagsKey]);

  const fetchOptionsRef = useRef(fetchOptions);
  fetchOptionsRef.current = fetchOptions;

  // ✅ queryKey inclui todos os filtros aplicados no banco para archived + tags
  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id, role, deptKey, scope, tagsKey,
      ...(scope === 'archived' ? [
        filters?.aiMode,
        filters?.dateRange?.from?.toISOString(),
        filters?.dateRange?.to?.toISOString(),
        filters?.channels?.join(','),
        filters?.department,
        filters?.assignedTo,
      ] : []),
    ],
    queryFn: async () => {
      const data = await fetchInboxData(fetchOptions);
      
      if (data.length > 0) {
        lastSeenRef.current = data[data.length - 1].updated_at;
      }

      // ✅ Retorna dados BRUTOS — sem applyFilters
      return data;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    enabled: !!user && !roleLoading && !deptLoading,
  });

  // ✅ Filtragem instantânea via useMemo (0ms, sem rede)
  const filteredData = useMemo(
    () => applyFilters(query.data ?? [], filters, undefined, scope),
    [query.data, filters, scope]
  );

  // Realtime subscription com merge incremental e catch-up
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
          const DEBUG = typeof window !== 'undefined' && 
            (window.localStorage?.getItem('inboxDebug') === '1' || import.meta.env.DEV);
          
          const row = (payload.new || payload.old) as InboxViewItem;
          if (!row?.conversation_id) return;

          const userId = user?.id;
          if (!userId) return;

          const currentRole = roleRef.current;
          const currentDeptIds = departmentIdsRef.current || [];
          const hasFullAccess = hasFullInboxAccess(currentRole);

          const isInAllowedDepartment = 
            row.department !== null && currentDeptIds.includes(row.department);

          const isAssignedToMe = row.assigned_to === userId;

          const isUnassignedAllowed = 
            row.assigned_to === null && 
            (row.department === null || isInAllowedDepartment);

          const isAssignedToColleagueInMyDept = 
            row.assigned_to !== null && 
            row.assigned_to !== userId && 
            row.department !== null && 
            isInAllowedDepartment;

          const shouldShow = hasFullAccess || 
            isAssignedToMe || 
            isUnassignedAllowed ||
            isAssignedToColleagueInMyDept;

          if (DEBUG) {
            console.log(`[Inbox-Debug] ${new Date().toISOString()} | EVENT=${payload.eventType} | conv=${row.conversation_id.slice(0, 8)}`);
            console.log(`[Inbox-Debug] shouldShow=${shouldShow} | me=${isAssignedToMe} | unassignedAllowed=${isUnassignedAllowed} | colleagueSameDept=${isAssignedToColleagueInMyDept} | dept=${row.department ?? 'null'}`);
          }

          // ✅ Determinar scope do item baseado no status
          const itemScope: InboxScope = row.status === 'closed' ? 'archived' : 'active';
          const otherScope: InboxScope = itemScope === 'active' ? 'archived' : 'active';

          // ✅ Merge no cache correto (usando scope, sem filtersKey)
          queryClient.setQueryData<InboxViewItem[]>(
            [...QUERY_KEY, userId, currentRole, deptKeyRef.current, itemScope],
            (prev = []) => {
              if (payload.eventType === "DELETE") {
                if (DEBUG) console.warn(`[Inbox-Debug] ⚠️ REMOVED (DELETE): ${row.conversation_id.slice(0, 8)}`);
                return prev.filter(item => item.conversation_id !== row.conversation_id);
              }

              if (!shouldShow) {
                if (DEBUG) console.log(`[Inbox-Debug] ⏭️ IGNORED (shouldShow=false): ${row.conversation_id.slice(0, 8)}`);
                return prev;
              }

              if (DEBUG) console.log(`[Inbox-Debug] ✅ MERGED: ${row.conversation_id.slice(0, 8)} -> scope=${itemScope}`);
              return mergeInboxItems(prev, [row as InboxViewItem]);
            }
          );

          // ✅ Remover do cache oposto (ex: conversa fechou -> sai do active)
          queryClient.setQueryData<InboxViewItem[]>(
            [...QUERY_KEY, userId, currentRole, deptKeyRef.current, otherScope],
            (prev) => {
              if (!prev) return prev;
              const without = prev.filter(item => item.conversation_id !== row.conversation_id);
              if (without.length === prev.length) return prev; // sem mudança, sem re-render
              if (DEBUG) console.log(`[Inbox-Debug] 🔄 MOVED from ${otherScope} to ${itemScope}: ${row.conversation_id.slice(0, 8)}`);
              return without;
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
              queryClient.setQueryData<InboxViewItem[]>(
                [...QUERY_KEY, user?.id, roleRef.current, deptKeyRef.current, scopeRef.current],
                (prev = []) => mergeInboxItems(prev, catchUpData)
              );
              lastSeenRef.current = catchUpData[catchUpData.length - 1].updated_at;
            }
          } catch (error) {
            console.error("[Realtime] Catch-up failed:", error);
          }
        }
      });

    // Canal 2: messages GLOBAL para atualizar snippet e unread_count
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
          
          queryClient.invalidateQueries({ queryKey: ["inbox-counts"], exact: false });
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] messages global subscription status:", status);
      });

    // Canal 3: conversations para detectar NOVAS conversas imediatamente
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
  }, [queryClient, user?.id]);

  // Visibility change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && lastSeenRef.current) {
        console.log("[Visibility] Tab became visible, running catch-up...");
        fetchInboxData({ cursor: lastSeenRef.current, ...fetchOptionsRef.current }).then(data => {
          if (data.length > 0) {
            queryClient.setQueryData<InboxViewItem[]>(
              [...QUERY_KEY, user?.id, roleRef.current, deptKeyRef.current, scopeRef.current],
              (prev = []) => mergeInboxItems(prev, data)
            );
            lastSeenRef.current = data[0].updated_at;
          }
        }).catch(console.error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [queryClient, user?.id]);

  // Função para resetar unread count ao abrir conversa
  const resetUnreadCount = useCallback(async (conversationId: string) => {
    try {
      await supabase.rpc("reset_inbox_unread_count", {
        p_conversation_id: conversationId,
      });
      // Atualização otimista no cache usando scope (sem filtersKey)
      queryClient.setQueryData<InboxViewItem[]>(
        [...QUERY_KEY, user?.id, roleRef.current, deptKeyRef.current, scopeRef.current],
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
    data: filteredData,    // ✅ dados filtrados (para UI)
    rawData: query.data,   // ✅ dados brutos (para debug/referência)
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
  myNotResponded: number;
  unassigned: number;
  unread: number;
  closed: number;
  byDepartment: Array<{ id: string; name: string; color: string | null; count: number }>;
  byTag: Array<{ id: string; name: string; color: string | null; count: number }>;
}

export function useInboxCounts(userId?: string) {
  const { role, loading: roleLoading } = useUserRole();
  const { department: userDepartmentId } = useAuth();
  const { departmentIds, isLoading: deptLoading } = useDepartmentsByRole(role, userDepartmentId);

  const isRoleReady = !roleLoading && role !== null && role !== undefined;
  const effectiveRole = isRoleReady ? role : null;

  return useQuery<InboxCounts>({
    queryKey: ["inbox-counts", userId, effectiveRole, departmentIds],
    enabled: !!userId && isRoleReady && !deptLoading,
    queryFn: async (): Promise<InboxCounts> => {
      const { data, error } = await supabase.functions.invoke("get-inbox-counts");
      if (error) {
        const status = (error as any)?.status;
        const message = (error as any)?.message || "";
        const isBootError = status === 503 || message.includes("BOOT_ERROR");
        if (isBootError) {
          console.warn("[useInboxCounts] BOOT_ERROR (cold start), will retry via React Query...");
          // Throw para ativar o retry do React Query ao invés de retornar dados vazios
          throw Object.assign(new Error("BOOT_ERROR: Function failed to start"), { status: 503 });
        }
        throw error;
      }
      return (data?.counts || {
        total: 0, mine: 0, aiQueue: 0, humanQueue: 0,
        slaCritical: 0, slaWarning: 0, notResponded: 0, myNotResponded: 0,
        unassigned: 0, unread: 0, closed: 0, byDepartment: [], byTag: [],
      }) as InboxCounts;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: (failureCount, error: any) => {
      const status = error?.status;
      const message = error?.message || "";
      const isBootError = status === 503 || String(message).includes("BOOT_ERROR");
      return isBootError ? failureCount < 5 : failureCount < 2;
    },
    retryDelay: (attempt) => {
      const base = Math.min(750 * 2 ** attempt, 6000);
      return base + Math.floor(Math.random() * 250);
    },
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
