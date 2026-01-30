import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
// hasFullInboxAccess não mais usado - lista MANAGER_ROLES definida localmente para clareza
import { isDepartmentAllowedByName } from "@/utils/departmentMatch";

interface TakeControlParams {
  conversationId: string;
  contactId: string;
}

// Mapeamento de roles para departamentos permitidos (por nome)
const ROLE_DEPARTMENT_MAP: Record<string, string[]> = {
  sales_rep: ["Comercial", "Vendas", "Sales"],
  support_agent: ["Suporte", "Support", "Atendimento"],
  financial_agent: ["Financeiro", "Finance", "Financial"],
  consultant: [], // Consultant pode assumir qualquer conversa atribuída a ele
};

/**
 * Hook para assumir controle de conversa (Autopilot → Copilot)
 * Muda ai_mode para 'copilot' e atribui conversa ao usuário atual
 * 
 * VALIDAÇÃO DE DEPARTAMENTO: 
 * - sales_rep só pode assumir conversas do departamento Comercial
 * - support_agent só pode assumir conversas do departamento Suporte
 * - Managers/Admins podem assumir qualquer conversa
 */
export function useTakeControl() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ conversationId, contactId }: TakeControlParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      console.log('[useTakeControl] Assumindo controle da conversa:', conversationId);

      // 0. Buscar role do usuário primeiro para verificar se precisa de validação de status
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const userRole = userRoleData?.role || null;
      
      // 🔒 Lista de roles com acesso total (gerentes e admins)
      // Esses roles NÃO precisam estar online para assumir conversas
      const MANAGER_ROLES = ['admin', 'manager', 'general_manager', 'support_manager', 'cs_manager'];
      const isManagerOrAdmin = userRole && MANAGER_ROLES.includes(userRole);
      
      console.log('[useTakeControl] Verificando permissão de assumir:', { 
        userRole, 
        isManagerOrAdmin,
        MANAGER_ROLES_CHECK: MANAGER_ROLES.includes(userRole || '')
      });
      
      // 🔒 Regra operacional: atendentes precisam estar ONLINE para assumir conversas.
      // EXCEÇÃO: Gerentes e Admins podem assumir conversas independente do status.
      if (!isManagerOrAdmin) {
        const { data: myProfile, error: myProfileError } = await supabase
          .from('profiles')
          .select('availability_status')
          .eq('id', user.id)
          .single();

        if (myProfileError) {
          console.error('[useTakeControl] Erro ao verificar availability_status:', myProfileError);
          throw new Error('Não foi possível verificar seu status. Tente novamente.');
        }

        if (myProfile?.availability_status !== 'online') {
          throw new Error('Para assumir uma conversa, altere seu status para Online e tente novamente.');
        }
      } else {
        console.log('[useTakeControl] ✅ Usuário é gerente/admin - status online não obrigatório');
      }

      // Buscar dados da conversa para validação (role já foi buscado acima)
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id, department, assigned_to, ai_mode, status, departments:department(id, name)')
        .eq('id', conversationId)
        .single();

      if (!conversation) {
        throw new Error('Conversa não encontrada');
      }

      // FIXED: Verificar ai_mode (não status) para waiting_human, pois status é 'open' no banco
      const isAvailableAIConversation =
        !conversation.assigned_to &&
        (conversation.ai_mode === 'autopilot' || conversation.ai_mode === 'waiting_human');

      // ✅ Regra solicitada: qualquer usuário pode assumir conversas não atribuídas da IA
      // (destrava vendedores e suporte). Mantém validação antiga apenas para casos fora disso.
      if (!isAvailableAIConversation && userRole && !MANAGER_ROLES.includes(userRole)) {
        const allowedDepartments = ROLE_DEPARTMENT_MAP[userRole];
        const conversationDeptName = (conversation.departments as any)?.name || null;
        
        // Se a conversa tem departamento e o role tem restrições
        if (conversationDeptName && allowedDepartments && allowedDepartments.length > 0) {
          const isAllowed = isDepartmentAllowedByName(allowedDepartments, conversationDeptName);
          
          if (!isAllowed) {
            console.warn('[useTakeControl] ❌ Bloqueado: role', userRole, 'não pode assumir conversa do departamento', conversationDeptName);
            throw new Error(`Você não tem permissão para assumir conversas do departamento ${conversationDeptName}. Apenas conversas do seu departamento podem ser assumidas.`);
          }
        }
        
        console.log('[useTakeControl] ✅ Validação de departamento OK:', { userRole, conversationDeptName, allowedDepartments });
      }

      // 1. Atualizar conversa para copilot + atribuir ao usuário
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          ai_mode: 'copilot',
          assigned_to: user.id 
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      // 🔧 FIX: Verificar se a atualização foi aplicada (proteção contra race condition)
      const { data: updatedConv } = await supabase
        .from('conversations')
        .select('ai_mode, assigned_to')
        .eq('id', conversationId)
        .single();

      if (updatedConv?.ai_mode !== 'copilot' || updatedConv?.assigned_to !== user.id) {
        console.warn('[useTakeControl] ⚠️ ai_mode não foi atualizado! Tentando novamente...');
        // Retry com força
        await supabase
          .from('conversations')
          .update({ ai_mode: 'copilot', assigned_to: user.id })
          .eq('id', conversationId);
      }

      console.log('[useTakeControl] ✅ Conversa atualizada para copilot:', updatedConv?.ai_mode);

      // 2. Buscar perfil do usuário para mensagem de sistema
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, job_title')
        .eq('id', user.id)
        .single();

      // FASE 3: Inserir mensagem de sistema no chat (visível para cliente)
      const { error: systemMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: `O atendente **${profile?.full_name || 'Suporte'}** entrou na conversa.`,
          sender_type: 'system',
          sender_id: user.id,
          is_ai_generated: false
        });

      if (systemMsgError) {
        console.error('[useTakeControl] Erro ao criar mensagem de sistema:', systemMsgError);
      }

      // 3. Gerar nota interna via auto-handoff (opcional - pode ser feito manualmente)
      // Buscar últimas mensagens
      const { data: messages } = await supabase
        .from('messages')
        .select('content, sender_type, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (messages && messages.length > 0) {
        const lastMessages = messages.reverse().map(m => ({
          content: m.content,
          sender_type: m.sender_type as 'user' | 'contact' | 'system',
          created_at: m.created_at
        }));

        // Chamar auto-handoff para gerar resumo
        await supabase.functions.invoke('auto-handoff', {
          body: { conversationId, lastMessages }
        });
      }

      // 4. Registrar interação de tomada de controle
      const { error: interactionError } = await supabase
        .from('interactions')
        .insert({
          customer_id: contactId,
          type: 'note',
          content: `👤 **Controle Assumido**\n\n${profile?.full_name || 'Atendente'} assumiu o controle da conversa. Modo mudado de Autopilot para Copilot (IA assistente).`,
          channel: 'other',
          metadata: {
            take_control: true,
            conversation_id: conversationId,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }
        });

      if (interactionError) {
        console.error('[useTakeControl] Erro ao registrar interação:', interactionError);
      }

      return { conversationId };
    },
    onMutate: async ({ conversationId }) => {
      // 🚀 OPTIMISTIC UPDATE: Atualiza o cache ANTES da mutation completar
      // Isso garante que o composer apareça INSTANTANEAMENTE após clicar em Assumir
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["ai-mode", conversationId] });
      await queryClient.cancelQueries({ queryKey: ["conversations"] });
      
      // Snapshot previous values
      const previousAIMode = queryClient.getQueryData(["ai-mode", conversationId]);
      const previousConversations = queryClient.getQueryData(["conversations"]);
      
      // Optimistically update ai-mode to 'copilot'
      queryClient.setQueryData(["ai-mode", conversationId], 'copilot');
      
      // Also update conversations cache if it exists
      queryClient.setQueriesData({ queryKey: ["conversations"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((conv: any) => 
            conv.id === conversationId 
              ? { ...conv, ai_mode: 'copilot', assigned_to: user?.id }
              : conv
          );
        }
        if (old.id === conversationId) {
          return { ...old, ai_mode: 'copilot', assigned_to: user?.id };
        }
        return old;
      });
      
      return { previousAIMode, previousConversations, conversationId };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousAIMode !== undefined) {
        queryClient.setQueryData(["ai-mode", context.conversationId], context.previousAIMode);
      }
      if (context?.previousConversations !== undefined) {
        queryClient.setQueryData(["conversations"], context.previousConversations);
      }
      
      console.error('[useTakeControl] Erro:', error);
      toast({
        title: "Erro ao assumir controle",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: ({ conversationId }) => {
      // Revalidate to sync with server
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["ai-mode", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["customer-timeline"] });
      
      toast({
        title: "✋ Controle Assumido",
        description: "Você agora está no modo Copilot. A IA irá sugerir respostas para você.",
      });
    },
  });
}

// Hook useCanTakeControl foi movido para src/hooks/useCanTakeControl.tsx
