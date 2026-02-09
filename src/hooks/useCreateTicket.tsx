import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateTicketData {
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  customer_id?: string;
  assigned_to?: string;
  conversation_id?: string;
  attachments?: any[];
  department_id?: string;
  tag_ids?: string[]; // NOVO - opcional
}

export function useCreateTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketData: CreateTicketData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Separar tag_ids do payload
      const { tag_ids, ...ticketPayload } = ticketData;
      
      // 1. Criar ticket
      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          ...ticketPayload,
          customer_id: ticketPayload.customer_id || undefined, // NULL ao invés de string vazia
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // 2. Inserir tags (com upsert para idempotência)
      let tagsWarning = false;
      if (tag_ids && tag_ids.length > 0 && ticket) {
        const tagInserts = tag_ids.map(tag_id => ({
          ticket_id: ticket.id,
          tag_id,
        }));
        
        const { error: tagsError } = await supabase
          .from("ticket_tags")
          .upsert(tagInserts, { 
            onConflict: "ticket_id,tag_id",
            ignoreDuplicates: true 
          });
        
        if (tagsError) {
          console.error("[useCreateTicket] Tags error:", tagsError);
          tagsWarning = true;
        }
      }

      // Manter retorno compatível - anexar flag opcional
      if (tagsWarning) {
        (ticket as any).__tagsWarning = true;
      }

      // --- Stakeholders + evento + notify (upgrade: email interno) ---
      try {
        // 1) Garantir stakeholders (creator + assignee)
        const stakeholderRows = [
          user?.id ? { ticket_id: ticket.id, user_id: user.id, role: 'creator' } : null,
          ticket.assigned_to ? { ticket_id: ticket.id, user_id: ticket.assigned_to, role: 'assignee' } : null,
        ].filter(Boolean);

        if (stakeholderRows.length) {
          await supabase
            .from('ticket_stakeholders')
            .upsert(stakeholderRows as any, { onConflict: 'ticket_id,user_id,role', ignoreDuplicates: true });
        }

        // 2) Criar evento canônico
        const { data: createdEvent } = await supabase
          .from('ticket_events')
          .insert({
            ticket_id: ticket.id,
            event_type: 'created',
            actor_id: user?.id || null,
            metadata: {
              subject: ticket.subject,
              priority: ticket.priority,
              status: ticket.status,
              department_id: ticket.department_id,
            },
          })
          .select('id')
          .single();

        // 3) Fanout interno + email para envolvidos
        if (createdEvent) {
          await supabase.functions.invoke('notify-ticket-event', {
            body: {
              ticket_id: ticket.id,
              event_type: 'created',
              actor_id: user?.id || null,
              ticket_event_id: createdEvent.id,
              channels: ['email', 'in_app'],
            },
          });
        }
      } catch (notifyErr) {
        // Não quebra o fluxo se notificação falhar
        console.warn('[useCreateTicket] Notify error (non-blocking):', notifyErr);
      }

      return ticket;
    },
    onSuccess: (ticket: any) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      
      // Invalidar tags do ticket específico
      if (ticket?.id) {
        queryClient.invalidateQueries({ queryKey: ["ticket-tags", ticket.id] });
      }
      
      // Detectar flag de warning
      const tagsWarning = !!ticket?.__tagsWarning;
      
      if (tagsWarning) {
        toast({
          title: "Ticket criado",
          description: "Ticket criado com sucesso, mas houve um problema ao salvar as tags.",
        });
      } else {
        toast({
          title: "Ticket criado com sucesso",
        });
      }
    },
    onError: (error: Error) => {
      console.error('Ticket creation error:', error);
      
      let description = error.message;
      
      // Tratamento específico para erros de RLS
      if (error.message.includes('row-level security')) {
        description = "Você não tem permissão para criar tickets. Verifique se você possui uma role válida (support_agent, support_manager, admin, manager).";
      } else if (error.message.includes('violates foreign key')) {
        description = "Cliente ou usuário inválido. Verifique os dados e tente novamente.";
      } else if (error.message.includes('not-null constraint')) {
        description = "Campos obrigatórios não preenchidos. Verifique os dados e tente novamente.";
      }
      
      toast({
        title: "Erro ao criar ticket",
        description,
        variant: "destructive",
      });
    },
  });
}
