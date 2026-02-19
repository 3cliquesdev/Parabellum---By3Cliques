import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Check, CheckCheck, Ticket, MessageSquare, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  metadata: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data as unknown as Notification[]);
      setUnreadCount((data as unknown as Notification[]).filter((n) => !n.read).length);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notification-bell")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true } as any).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true } as any)
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getNotificationTarget = (n: Notification): string | null => {
    const md = (n.metadata ?? {}) as any;

    // Universal: action_url tem prioridade
    if (md.action_url) return md.action_url;

    // Fallback por type para notificações antigas
    switch (n.type) {
      case 'ticket_created':
      case 'ticket_status':
      case 'ticket_transfer':
      case 'ticket_reply':
      case 'internal_comment':
        return md.ticket_id ? `/support?ticket=${md.ticket_id}` : null;
      case 'new_lead':
        return md.conversation_id
          ? `/inbox?conversation=${md.conversation_id}`
          : '/inbox';
      case 'payment_pending_validation':
      case 'subscription_renewal':
      case 'deal_marked_organic':
      case 'deal_critical':
      case 'deal_warning':
      case 'deal_escalation':
      case 'deal_escalated':
        return md.deal_id ? `/deals?deal=${md.deal_id}` : '/deals';
      case 'passive_learning_pending':
      case 'knowledge_approval':
      case 'ai_learning':
        return '/settings/ai-audit';
      default:
        return null;
    }
  };

  const handleClick = (notif: Notification) => {
    if (!notif.read) markAsRead(notif.id);
    const target = getNotificationTarget(notif);
    if (target) navigate(target);
    setOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "ticket_created":
      case "ticket_status":
      case "ticket_transfer":
      case "ticket_reply":
      case "internal_comment":
        return <Ticket className="h-4 w-4 text-primary flex-shrink-0" />;
      case "new_lead":
        return <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />;
      case "deal_critical":
      case "deal_warning":
      case "deal_escalation":
      case "deal_escalated":
      case "deal_marked_organic":
      case "subscription_renewal":
      case "payment_pending_validation":
        return <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
      case "passive_learning_pending":
      case "knowledge_approval":
      case "ai_learning":
        return <Info className="h-4 w-4 text-primary flex-shrink-0" />;
      default:
        return <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative ml-2">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  !notif.read ? "bg-primary/5" : ""
                }`}
              >
                {getIcon(notif.type)}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-tight ${!notif.read ? "font-semibold" : ""}`}>
                    {notif.title}
                  </p>
                  {notif.message && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {notif.message}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(notif.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                {!notif.read && (
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
