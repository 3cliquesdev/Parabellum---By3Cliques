import { 
  Mail, MailOpen, MousePointerClick,
  PhoneIncoming, PhoneOutgoing,
  MessageCircle, MessageCircleReply,
  Calendar, FileText, Plus,
  CheckCircle, XCircle, StickyNote, TrendingUp,
  ArrowRightLeft
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

interface IconConfig {
  icon: any;
  color: string;
  bg: string;
}

const INTERACTION_ICONS: Record<string, IconConfig> = {
  email_sent: { icon: Mail, color: "text-blue-500", bg: "bg-blue-500/10" },
  email_open: { icon: MailOpen, color: "text-green-500", bg: "bg-green-500/10" },
  email_click: { icon: MousePointerClick, color: "text-purple-500", bg: "bg-purple-500/10" },
  call_incoming: { icon: PhoneIncoming, color: "text-blue-500", bg: "bg-blue-500/10" },
  call_outgoing: { icon: PhoneOutgoing, color: "text-orange-500", bg: "bg-orange-500/10" },
  whatsapp_msg: { icon: MessageCircle, color: "text-green-500", bg: "bg-green-500/10" },
  whatsapp_reply: { icon: MessageCircleReply, color: "text-green-500", bg: "bg-green-500/10" },
  meeting: { icon: Calendar, color: "text-purple-500", bg: "bg-purple-500/10" },
  form_submission: { icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
  deal_created: { icon: Plus, color: "text-blue-500", bg: "bg-blue-500/10" },
  deal_won: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  deal_lost: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  note: { icon: StickyNote, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  status_change: { icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10" },
  conversation_transferred: { icon: ArrowRightLeft, color: "text-blue-500", bg: "bg-blue-500/10" },
};

interface TimelineItemProps {
  interaction: Tables<"interactions">;
}

export default function TimelineItem({ interaction }: TimelineItemProps) {
  const iconConfig = INTERACTION_ICONS[interaction.type] || INTERACTION_ICONS.note;
  const Icon = iconConfig.icon;

  return (
    <div className="flex gap-4 group">
      {/* Ícone circular */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${iconConfig.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
        <Icon className={`h-5 w-5 ${iconConfig.color}`} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 pb-4">
        <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize">
                {interaction.channel}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(interaction.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </div>
          </div>

          <p className="text-sm text-foreground whitespace-pre-wrap">{interaction.content}</p>

          {/* Metadata expandível */}
          {interaction.metadata && Object.keys(interaction.metadata).length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Ver detalhes técnicos
              </summary>
              <pre className="mt-2 text-xs bg-muted/50 p-3 rounded border overflow-auto max-h-40">
                {JSON.stringify(interaction.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
