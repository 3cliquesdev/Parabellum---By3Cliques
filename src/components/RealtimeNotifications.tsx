import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
type Contact = Tables<"contacts">;

export default function RealtimeNotifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
  }, [user, location.pathname, navigate, queryClient]);

  return null;
}
