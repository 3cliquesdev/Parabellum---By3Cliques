import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Ticket, DollarSign } from "lucide-react";
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

  // Request notification permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Listen for new messages from contacts
  useEffect(() => {
    // Don't set up realtime listener if user is not authenticated
    if (!user) {
      console.log("RealtimeNotifications: User not authenticated, skipping setup");
      return;
    }

    console.log("RealtimeNotifications: Setting up message listener for authenticated user");

    try {
      const channel = supabase
        .channel("global-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "sender_type=eq.contact", // Only notify for messages from contacts
        },
        async (payload) => {
          console.log("New message received:", payload);
          const newMessage = payload.new as Message;

          // Fetch conversation details to get contact name
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
            if (!location.pathname.includes("/inbox")) {
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

            // Invalidate conversations query to update last_message_at
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          } catch (error) {
            console.error("Error in message notification:", error);
          }
        }
      )
      .subscribe((status) => {
        console.log("RealtimeNotifications subscription status:", status);
      });

      return () => {
        console.log("RealtimeNotifications: Cleaning up");
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("RealtimeNotifications: Error setting up listener", error);
    }
  }, [user, navigate, queryClient]); // Removed location.pathname to prevent re-subscriptions on route change

  // Listen for conversation assignments (FASE 4: Advanced Notifications)
  useEffect(() => {
    if (!user) return;

    console.log("[RealtimeNotifications] Setting up conversation assignment listener");

    try {
      const channel = supabase
        .channel("conversation-assignments")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversations",
            filter: `assigned_to=eq.${user.id}`,
          },
          async (payload) => {
            console.log("[RealtimeNotifications] Conversation assigned:", payload);

            // Fetch conversation details
            const { data: conversation, error } = await supabase
              .from("conversations")
              .select(`
                id,
                contacts (
                  first_name,
                  last_name
                )
              `)
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

              // Play notification sound
              play();

              // Show persistent toast
              toast(
                "🔔 Nova conversa atribuída",
                {
                  description: `Cliente: ${contactName}`,
                  icon: <MessageSquare className="h-4 w-4" />,
                  action: {
                    label: "Ver agora",
                    onClick: () => navigate("/inbox"),
                  },
                  duration: 10000, // 10 seconds
                }
              );

              // Show browser notification if user is in another tab
              if (document.hidden) {
                showBrowserNotification(
                  "Nova conversa atribuída",
                  `Cliente: ${contactName}`
                );
              }
            }

            // Invalidate conversations to update the list
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }
        )
        .subscribe((status) => {
          console.log("RealtimeNotifications assignment subscription status:", status);
        });

      return () => {
        console.log("[RealtimeNotifications] Cleaning up assignment listener");
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("[RealtimeNotifications] Error setting up assignment listener", error);
    }
  }, [user, navigate, play, showBrowserNotification, queryClient]);

  // Listen for new SLA alerts (FASE 3: SLA Alert Notifications)
  useEffect(() => {
    if (!user) return;

    console.log("[RealtimeNotifications] Setting up SLA alert listener");

    try {
      const channel = supabase
        .channel("sla-alerts")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "sla_alerts",
          },
          async (payload) => {
            console.log("[RealtimeNotifications] New SLA alert:", payload);

            // Fetch alert with conversation details
            const { data: alert, error } = await supabase
              .from("sla_alerts")
              .select(`
                *,
                conversations (
                  contacts (
                    first_name,
                    last_name
                  )
                )
              `)
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

              // Play alert sound
              play();

              // Show critical toast
              toast(
                "🚨 ALERTA SLA: Conversa sem resposta",
                {
                  description: `${contactName} aguardando há ${alert.actual_minutes} min`,
                  icon: <MessageSquare className="h-4 w-4" />,
                  action: {
                    label: "Assumir Conversa",
                    onClick: () => navigate("/inbox"),
                  },
                  duration: 0, // Persistent until dismissed
                  className: "border-destructive bg-destructive/10",
                }
              );

              // Show browser notification
              if (document.hidden) {
                showBrowserNotification(
                  "🚨 SLA Violado",
                  `${contactName} aguardando há ${alert.actual_minutes} min`
                );
              }
            }

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ["sla-alerts"] });
          }
        )
        .subscribe((status) => {
          console.log("RealtimeNotifications SLA subscription status:", status);
        });

      return () => {
        console.log("[RealtimeNotifications] Cleaning up SLA listener");
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("[RealtimeNotifications] Error setting up SLA listener", error);
    }
  }, [user, navigate, play, showBrowserNotification, queryClient]);

  // Listen for ticket comment notifications
  useEffect(() => {
    if (!user) return;

    console.log("[RealtimeNotifications] Setting up ticket comment listener");

    try {
      const channel = supabase
        .channel("ticket-comments-notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "ticket_comments",
          },
          async (payload) => {
            console.log("[RealtimeNotifications] New ticket comment:", payload);

            const comment = payload.new as any;

            // Don't notify for own comments
            if (comment.created_by === user.id) {
              return;
            }

            // Fetch ticket details to check relationships
            const { data: ticket, error } = await supabase
              .from("tickets")
              .select(`
                id,
                ticket_number,
                subject,
                created_by,
                assigned_to
              `)
              .eq("id", comment.ticket_id)
              .single();

            if (error || !ticket) {
              console.error("Error fetching ticket:", error);
              return;
            }

            // Notify if current user is the ticket creator and someone else commented
            if (ticket.created_by === user.id) {
              play();

              toast(
                "📩 Nova resposta no seu ticket",
                {
                  description: `#${ticket.ticket_number}: ${ticket.subject}`,
                  icon: <Ticket className="h-4 w-4" />,
                  action: {
                    label: "Ver",
                    onClick: () => navigate(`/support?ticket=${ticket.id}`),
                  },
                  duration: 10000,
                }
              );

              if (document.hidden) {
                showBrowserNotification(
                  "Nova resposta no seu ticket",
                  `#${ticket.ticket_number}: ${ticket.subject}`
                );
              }
            }

            // Notify if current user is assigned and the creator commented
            if (ticket.assigned_to === user.id && ticket.created_by === comment.created_by) {
              play();

              toast(
                "📨 Criador respondeu no ticket",
                {
                  description: `#${ticket.ticket_number}: ${ticket.subject}`,
                  icon: <Ticket className="h-4 w-4" />,
                  action: {
                    label: "Ver",
                    onClick: () => navigate(`/support?ticket=${ticket.id}`),
                  },
                  duration: 10000,
                }
              );

              if (document.hidden) {
                showBrowserNotification(
                  "Criador respondeu no ticket",
                  `#${ticket.ticket_number}: ${ticket.subject}`
                );
              }
            }

            // Invalidate tickets query
            queryClient.invalidateQueries({ queryKey: ["tickets"] });
            queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
          }
        )
        .subscribe((status) => {
          console.log("RealtimeNotifications ticket comments subscription status:", status);
        });

      return () => {
        console.log("[RealtimeNotifications] Cleaning up ticket comment listener");
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("[RealtimeNotifications] Error setting up ticket comment listener", error);
    }
  }, [user, navigate, play, showBrowserNotification, queryClient]);

  // Listen for deal assignments (notify salesperson of new opportunities)
  useEffect(() => {
    if (!user) return;

    console.log("[RealtimeNotifications] Setting up deal assignment listener");

    try {
      const channel = supabase
        .channel("deal-assignments")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "deals",
            filter: `assigned_to=eq.${user.id}`,
          },
          async (payload) => {
            console.log("[RealtimeNotifications] Deal assigned:", payload);

            const newDeal = payload.new as Deal;
            const oldDeal = payload.old as Deal;

            // Only notify if assigned_to actually changed to this user
            if (oldDeal.assigned_to === newDeal.assigned_to) {
              return;
            }

            // Fetch deal details with contact
            const { data: deal, error } = await supabase
              .from("deals")
              .select(`
                id,
                title,
                value,
                contacts (
                  first_name,
                  last_name
                )
              `)
              .eq("id", newDeal.id)
              .single();

            if (error || !deal) {
              console.error("Error fetching deal:", error);
              return;
            }

            const contact = Array.isArray(deal.contacts)
              ? deal.contacts[0]
              : deal.contacts;

            const contactName = contact
              ? `${contact.first_name} ${contact.last_name}`
              : "Sem contato";

            const valueFormatted = deal.value
              ? new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(deal.value)
              : "";

            // Play notification sound
            play();

            // Show persistent toast
            toast("💰 Novo deal atribuído a você!", {
              description: `${deal.title}${valueFormatted ? ` • ${valueFormatted}` : ""}${contact ? ` • ${contactName}` : ""}`,
              icon: <DollarSign className="h-4 w-4" />,
              action: {
                label: "Ver Deal",
                onClick: () => navigate("/deals"),
              },
              duration: 10000, // 10 seconds
            });

            // Show browser notification if user is in another tab
            if (document.hidden) {
              showBrowserNotification(
                "💰 Novo deal atribuído!",
                `${deal.title}${valueFormatted ? ` - ${valueFormatted}` : ""}`
              );
            }

            // Invalidate deals queries to update the list
            queryClient.invalidateQueries({ queryKey: ["deals"] });
          }
        )
        .subscribe((status) => {
          console.log("RealtimeNotifications deal assignment subscription status:", status);
        });

      // Also listen for new deals inserted with assigned_to = user.id
      const insertChannel = supabase
        .channel("deal-assignments-insert")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "deals",
            filter: `assigned_to=eq.${user.id}`,
          },
          async (payload) => {
            console.log("[RealtimeNotifications] New deal created for user:", payload);

            const newDeal = payload.new as Deal;

            // Fetch deal details with contact
            const { data: deal, error } = await supabase
              .from("deals")
              .select(`
                id,
                title,
                value,
                contacts (
                  first_name,
                  last_name
                )
              `)
              .eq("id", newDeal.id)
              .single();

            if (error || !deal) {
              console.error("Error fetching deal:", error);
              return;
            }

            const contact = Array.isArray(deal.contacts)
              ? deal.contacts[0]
              : deal.contacts;

            const contactName = contact
              ? `${contact.first_name} ${contact.last_name}`
              : "Sem contato";

            const valueFormatted = deal.value
              ? new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(deal.value)
              : "";

            // Play notification sound
            play();

            // Show persistent toast
            toast("💰 Novo deal atribuído a você!", {
              description: `${deal.title}${valueFormatted ? ` • ${valueFormatted}` : ""}${contact ? ` • ${contactName}` : ""}`,
              icon: <DollarSign className="h-4 w-4" />,
              action: {
                label: "Ver Deal",
                onClick: () => navigate("/deals"),
              },
              duration: 10000,
            });

            // Show browser notification if user is in another tab
            if (document.hidden) {
              showBrowserNotification(
                "💰 Novo deal atribuído!",
                `${deal.title}${valueFormatted ? ` - ${valueFormatted}` : ""}`
              );
            }

            // Invalidate deals queries
            queryClient.invalidateQueries({ queryKey: ["deals"] });
          }
        )
        .subscribe((status) => {
          console.log("RealtimeNotifications deal insert subscription status:", status);
        });

      return () => {
        console.log("[RealtimeNotifications] Cleaning up deal assignment listeners");
        supabase.removeChannel(channel);
        supabase.removeChannel(insertChannel);
      };
    } catch (error) {
      console.error("[RealtimeNotifications] Error setting up deal assignment listener", error);
    }
  }, [user, navigate, play, showBrowserNotification, queryClient]);

  return null;
}
