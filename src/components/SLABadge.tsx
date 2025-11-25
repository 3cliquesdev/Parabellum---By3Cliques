import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SLABadgeProps {
  dueDate: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function SLABadge({ dueDate, priority, size = 'md', showIcon = true }: SLABadgeProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [isOverdue, setIsOverdue] = useState(false);
  const [urgencyLevel, setUrgencyLevel] = useState<'critical' | 'warning' | 'normal'>('normal');

  useEffect(() => {
    if (!dueDate) return;

    const calculateTimeRemaining = () => {
      const now = new Date();
      const due = new Date(dueDate);
      const diffMs = due.getTime() - now.getTime();

      if (diffMs < 0) {
        setIsOverdue(true);
        setUrgencyLevel('critical');
        const overdueMins = Math.abs(Math.floor(diffMs / (1000 * 60)));
        const overdueHours = Math.floor(overdueMins / 60);
        const remainingMins = overdueMins % 60;
        
        if (overdueHours > 0) {
          setTimeRemaining(`Vencido há ${overdueHours}h${remainingMins > 0 ? ` ${remainingMins}m` : ''}`);
        } else {
          setTimeRemaining(`Vencido há ${remainingMins}m`);
        }
        return;
      }

      setIsOverdue(false);
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // Set urgency level based on time remaining
      if (hours < 2) {
        setUrgencyLevel('critical');
      } else if (hours < 4) {
        setUrgencyLevel('warning');
      } else {
        setUrgencyLevel('normal');
      }

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeRemaining(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [dueDate]);

  if (!dueDate) {
    return (
      <Badge variant="secondary" className={cn(
        "gap-1",
        size === 'sm' && "text-xs py-0 h-5",
        size === 'md' && "text-xs",
        size === 'lg' && "text-sm"
      )}>
        {showIcon && <Clock className="h-3 w-3" />}
        Sem prazo
      </Badge>
    );
  }

  const getVariantStyles = () => {
    if (isOverdue) {
      return "bg-destructive/10 text-destructive border-destructive/30 animate-pulse";
    }
    
    switch(urgencyLevel) {
      case 'critical':
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30";
      case 'warning':
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
      default:
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30";
    }
  };

  const getPriorityLabel = () => {
    switch(priority) {
      case 'urgent': return '🔴 Urgente';
      case 'high': return '🟠 Alta';
      case 'medium': return '🟡 Média';
      case 'low': return '🟢 Baixa';
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1 font-medium border",
          getVariantStyles(),
          size === 'sm' && "text-xs py-0 h-5",
          size === 'md' && "text-xs",
          size === 'lg' && "text-sm"
        )}
      >
        {showIcon && (
          isOverdue ? 
            <AlertTriangle className="h-3 w-3" /> : 
            <Clock className="h-3 w-3" />
        )}
        {timeRemaining}
      </Badge>
      
      {size === 'lg' && (
        <Badge 
          variant="secondary"
          className="text-sm"
        >
          {getPriorityLabel()}
        </Badge>
      )}
    </div>
  );
}
