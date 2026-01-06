import {
  Inbox,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Circle,
  Archive,
  FolderOpen,
  User,
  MessageSquare,
  Send,
  Eye,
  Pause,
  Play,
  RefreshCw,
  Timer,
  Ban,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  'inbox': Inbox,
  'clock': Clock,
  'alert-circle': AlertCircle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'alert-triangle': AlertTriangle,
  'circle': Circle,
  'archive': Archive,
  'folder-open': FolderOpen,
  'user': User,
  'message-square': MessageSquare,
  'send': Send,
  'eye': Eye,
  'pause': Pause,
  'play': Play,
  'refresh-cw': RefreshCw,
  'timer': Timer,
  'ban': Ban,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  'flag': Flag,
  'star': Star,
  'zap': Zap,
};

export function getStatusIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Circle;
}

export { iconMap };
