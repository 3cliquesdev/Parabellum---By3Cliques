import { useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Ticket, DollarSign, Mail, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
type Contact = Tables<"contacts">;
type Deal = Tables<"deals">;

export default function RealtimeNotifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { play, requestPermission, showBrowserNotification } = useNotificationSound();
  
  // Use refs to avoid re-subscriptions on every render
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  // Request notification permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Handler for new messages from contacts
  const handleNewMessage = useCallback(async (payload: any) => {
    console.log("New message received:", payload);
    const newMessage = payload.new as Message;

    try {
      const { data: conversation, error } = await supabase
        .from("conversations")
        .select("*, contacts(*)")
        .eq("id", newMessage.conversation_id)
        .single();

      if (error) {
        console.error("Error fetching conversation:", error);
        return;
      }

      const contact = conversation.contacts as Contact;

      // Only show notification if not on inbox page
      if (!locationRef.current.includes("/inbox")) {
        toast(
          `${contact.first_name} ${contact.last_name}`,
          {
            description: newMessage.content.substring(0, 100) + (newMessage.content.length > 100 ? "..." : ""),
            icon: <MessageSquare className="h-4 w-4" />,
            action: {
              label: "Ver",
              onClick: () => navigate("/inbox"),
            },
            duration: 5000,
          }
        );
      }

      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (error) {
      console.error("Error in message notification:", error);
    }
  }, [navigate, queryClient]);

  // Handler for conversation assignments
  const handleConversationAssignment = useCallback(async (payload: any) => {
    console.log("[RealtimeNotifications] Conversation assigned:", payload);

    const { data: conversation, error } = await supabase
      .from("conversations")
      .select(`id, ai_mode, contacts (first_name, last_name)`)
      .eq("id", payload.new.id)
      .single();

    if (error || !conversation) {
      console.error("Error fetching conversation:", error);
      return;
    }

    const contact = Array.isArray(conversation.contacts) 
      ? conversation.contacts[0] 
      : conversation.contacts;

    if (contact) {
      const contactName = `${contact.first_name} ${contact.last_name}`;
      play();

      // 🔔 Notificação mais urgente quando ai_mode = copilot (IA não responde mais)
      const isCopilotMode = conversation.ai_mode === 'copilot';
      
      toast(isCopilotMode ? "🔔 Ação Necessária" : "Nova conversa atribuída", {
        description: isCopilotMode 
          ? `${contactName} aguarda SUA resposta. A IA não responderá mais.`
          : `Cliente: ${contactName}`,
        icon: isCopilotMode 
          ? <AlertTriangle className="h-4 w-4 text-orange-500" />
          : <MessageSquare className="h-4 w-4" />,
        action: {
          label: isCopilotMode ? "Responder agora" : "Ver agora",
          onClick: () => navigate(`/inbox?conversation=${payload.new.id}`),
        },
        duration: isCopilotMode ? 0 : 10000, // Não fecha automaticamente se copilot
      });

      if (document.hidden) {
        showBrowserNotification(
          isCopilotMode ? "🚨 Ação Necessária" : "Nova conversa atribuída", 
          isCopilotMode 
            ? `${contactName} aguarda SUA resposta!`
            : `Cliente: ${contactName}`
        );
      }
    }

    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [navigate, play, showBrowserNotification, queryClient]);

  // Handler for SLA alerts
  const handleSLAAlert = useCallback(async (payload: any) => {
    console.log("[RealtimeNotifications] New SLA alert:", payload);

    const { data: alert, error } = await supabase
      .from("sla_alerts")
      .select(`*, conversations (contacts (first_name, last_name))`)
      .eq("id", payload.new.id)
      .single();

    if (error || !alert) {
      console.error("Error fetching alert details:", error);
      return;
    }

    const contact = Array.isArray(alert.conversations?.contacts)
      ? alert.conversations.contacts[0]
      : alert.conversations?.contacts;

    if (contact) {
      const contactName = `${contact.first_name} ${contact.last_name}`;
      play();

      toast("ALERTA SLA: Conversa sem resposta", {
        description: `${contactName} aguardando há ${alert.actual_minutes} min`,
        icon: <MessageSquare className="h-4 w-4" />,
        action: {
          label: "Assumir Conversa",
          onClick: () => navigate("/inbox"),
        },
        duration: 0,
        className: "border-destructive bg-destructive/10",
      });

      if (document.hidden) {
        showBrowserNotification("🚨 SLA Violado", `${contactName} aguardando há ${alert.actual_minutes} min`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["sla-alerts"] });
  }, [navigate, play, showBrowserNotification, queryClient]);

  // Handler for ticket comments
  const handleTicketComment = useCallback(async (payload: any) => {
    console.log("[RealtimeNotifications] New ticket comment:", payload);
    const comment = payload.new as any;

    if (!user || comment.created_by === user.id) return;

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select(`id, ticket_number, subject, created_by, assigned_to`)
      .eq("id", comment.ticket_id)
      .single();

    if (error || !ticket) {
      console.error("Error fetching ticket:", error);
      return;
    }

    // Notify if current user is the ticket creator
    if (ticket.created_by === user.id) {
      play();
      toast("Nova resposta no seu ticket", {
        description: `#${ticket.ticket_number}: ${ticket.subject}`,
        icon: <Ticket className="h-4 w-4" />,
        action: {
          label: "Ver",
          onClick: () => navigate(`/support?ticket=${ticket.id}`),
        },
        duration: 10000,
      });

      if (document.hidden) {
        showBrowserNotification("Nova resposta no seu ticket", `#${ticket.ticket_number}: ${ticket.subject}`);
      }
    }

    // Notify if current user is assigned
    if (ticket.assigned_to === user.id) {
      const isEmailReply = comment.source === 'email_reply' && comment.created_by === null;
      const isCreatorReply = ticket.created_by === comment.created_by && comment.created_by !== null;
      
      if (isEmailReply || isCreatorReply) {
        play();
        const notificationTitle = isEmailReply ? "📧 Cliente respondeu por email" : "Criador respondeu no ticket";

        toast(notificationTitle, {
          description: `#${ticket.ticket_number}: ${ticket.subject}`,
          icon: isEmailReply ? <Mail className="h-4 w-4" /> : <Ticket className="h-4 w-4" />,
          action: {
            label: "Ver",
            onClick: () => navigate(`/support?ticket=${ticket.id}`),
          },
          duration: 10000,
        });

        if (document.hidden) {
          showBrowserNotification(notificationTitle, `#${ticket.ticket_number}: ${ticket.subject}`);
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
  }, [user, navigate, play, showBrowserNotification, queryClient]);

  // Handler for deal assignments
  const handleDealAssignment = useCallback(async (payload: any) => {
    console.log("[RealtimeNotifications] Deal assigned:", payload);
    const newDeal = payload.new as Deal;
    const oldDeal = payload.old as Deal;

    // Only notify if assigned_to actually changed
    if (oldDeal?.assigned_to === newDeal.assigned_to) return;

    const { data: deal, error } = await supabase
      .from("deals")
      .select(`id, title, value, contacts (first_name, last_name)`)
      .eq("id", newDeal.id)
      .single();

    if (error || !deal) {
      console.error("Error fetching deal:", error);
      return;
    }

    const contact = Array.isArray(deal.contacts) ? deal.contacts[0] : deal.contacts;
    const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Sem contato";
    const valueFormatted = deal.value
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.value)
      : "";

    play();

    toast("Novo deal atribuído a você!", {
      description: `${deal.title}${valueFormatted ? ` • ${valueFormatted}` : ""}${contact ? ` • ${contactName}` : ""}`,
      icon: <DollarSign className="h-4 w-4" />,
      action: {
        label: "Ver Deal",
        onClick: () => navigate("/deals"),
      },
      duration: 10000,
    });

    if (document.hidden) {
      showBrowserNotification("💰 Novo deal atribuído!", `${deal.title}${valueFormatted ? ` - ${valueFormatted}` : ""}`);
    }

    queryClient.invalidateQueries({ queryKey: ["deals"] });
  }, [navigate, play, showBrowserNotification, queryClient]);

  // Handler for new deals inserted
  const handleNewDeal = useCallback(async (payload: any) => {
    console.log("[RealtimeNotifications] New deal created for user:", payload);
    const newDeal = payload.new as Deal;

    const { data: deal, error } = await supabase
      .from("deals")
      .select(`id, title, value, contacts (first_name, last_name)`)
      .eq("id", newDeal.id)
      .single();

    if (error || !deal) {
      console.error("Error fetching deal:", error);
      return;
    }

    const contact = Array.isArray(deal.contacts) ? deal.contacts[0] : deal.contacts;
    const contactName = contact ? `${contact.first_name} ${contact.last_name}` : "Sem contato";
    const valueFormatted = deal.value
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.value)
      : "";

    play();

    toast("💰 Novo deal atribuído a você!", {
      description: `${deal.title}${valueFormatted ? ` • ${valueFormatted}` : ""}${contact ? ` • ${contactName}` : ""}`,
      icon: <DollarSign className="h-4 w-4" />,
      action: {
        label: "Ver Deal",
        onClick: () => navigate("/deals"),
      },
      duration: 10000,
    });

    if (document.hidden) {
      showBrowserNotification("💰 Novo deal atribuído!", `${deal.title}${valueFormatted ? ` - ${valueFormatted}` : ""}`);
    }

    queryClient.invalidateQueries({ queryKey: ["deals"] });
  }, [navigate, play, showBrowserNotification, queryClient]);

  // Handler for general notifications (renewal, payment validation, organic deals)
  const handleGeneralNotification = useCallback(async (payload: any) => {
    console.log("[RealtimeNotifications] Notification received:", payload);
    
    const notification = payload.new;
    
    // Only process if it's for the current user
    if (notification.user_id !== user?.id) return;

    const metadata = notification.metadata as { 
      contact_id?: string; 
      contact_name?: string;
      deal_id?: string;
      deal_title?: string;
      deadline?: string;
    } | null;

    // Handle different notification types
    switch (notification.type) {
      case 'subscription_renewal':
        play();
        toast(notification.title, {
          description: notification.message,
          icon: <RefreshCw className="h-4 w-4" />,
          action: metadata?.contact_id ? {
            label: "Ver Cliente",
            onClick: () => navigate(`/customers/${metadata.contact_id}`),
          } : undefined,
          duration: 10000,
        });
        break;

      case 'payment_pending_validation':
        play();
        toast.warning(notification.title, {
          description: notification.message,
          icon: <Clock className="h-4 w-4 text-yellow-500" />,
          action: metadata?.deal_id ? {
            label: "Validar Venda",
            onClick: () => navigate(`/deals?highlight=${metadata.deal_id}`),
          } : undefined,
          duration: 30000, // 30 segundos - mais tempo por ser urgente
        });
        break;

      case 'deal_marked_organic':
        play();
        toast(notification.title, {
          description: notification.message,
          icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
          action: metadata?.deal_id ? {
            label: "Ver Deal",
            onClick: () => navigate(`/deals?id=${metadata.deal_id}`),
          } : undefined,
          duration: 15000,
        });
        break;

      default:
        // Generic notification
        play();
        toast(notification.title, {
          description: notification.message,
          duration: 8000,
        });
        break;
    }

    if (document.hidden) {
      showBrowserNotification(notification.title, notification.message);
    }

    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["deals"] });
  }, [user, navigate, play, showBrowserNotification, queryClient]);

  // CONSOLIDATED: Single channel for all notifications - reduces websocket connections
  useEffect(() => {
    if (!user) {
      console.log("RealtimeNotifications: User not authenticated, skipping setup");
      return;
    }

    console.log("RealtimeNotifications: Setting up consolidated listener for user", user.id);

    try {
      // Single multiplexed channel for all user notifications
      const notificationsChannel = supabase
        .channel("user-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: "sender_type=eq.contact" },
          handleNewMessage
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversations", filter: `assigned_to=eq.${user.id}` },
          handleConversationAssignment
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sla_alerts" },
          handleSLAAlert
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "ticket_comments" },
          handleTicketComment
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "deals", filter: `assigned_to=eq.${user.id}` },
          handleDealAssignment
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "deals", filter: `assigned_to=eq.${user.id}` },
          handleNewDeal
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          handleGeneralNotification
        )
        .subscribe((status) => {
          console.log("RealtimeNotifications consolidated subscription status:", status);
        });

      return () => {
        console.log("RealtimeNotifications: Cleaning up consolidated listener");
        supabase.removeChannel(notificationsChannel);
      };
    } catch (error) {
      console.error("RealtimeNotifications: Error setting up consolidated listener", error);
    }
  }, [
    user,
    handleNewMessage,
    handleConversationAssignment,
    handleSLAAlert,
    handleTicketComment,
    handleDealAssignment,
    handleNewDeal,
    handleGeneralNotification
  ]);

  return null;
}
