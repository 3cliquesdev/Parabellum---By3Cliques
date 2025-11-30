import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, MessageCircle } from "lucide-react";

interface ChannelBadgeProps {
  channel: string;
  className?: string;
}

const channelConfig = {
  email: {
    icon: Mail,
    label: "E-mail",
    variant: "default" as const,
  },
  whatsapp: {
    icon: MessageCircle,
    label: "WhatsApp",
    variant: "default" as const,
  },
  platform: {
    icon: MessageSquare,
    label: "Chat",
    variant: "secondary" as const,
  },
};

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const config = channelConfig[channel as keyof typeof channelConfig] || channelConfig.platform;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}