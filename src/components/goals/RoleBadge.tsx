import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Phone, HeadphonesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleConfig: Record<string, { 
  label: string; 
  icon: React.ElementType; 
  bgColor: string;
  textColor: string;
}> = {
  sales_rep: { 
    label: "Vendedor", 
    icon: TrendingUp, 
    bgColor: "bg-blue-100 dark:bg-blue-900/30", 
    textColor: "text-blue-700 dark:text-blue-300" 
  },
  consultant: { 
    label: "Consultor CS", 
    icon: HeadphonesIcon, 
    bgColor: "bg-purple-100 dark:bg-purple-900/30", 
    textColor: "text-purple-700 dark:text-purple-300" 
  },
  sdr: { 
    label: "SDR", 
    icon: Phone, 
    bgColor: "bg-green-100 dark:bg-green-900/30", 
    textColor: "text-green-700 dark:text-green-300" 
  },
  manager: { 
    label: "Gerente", 
    icon: Users, 
    bgColor: "bg-amber-100 dark:bg-amber-900/30", 
    textColor: "text-amber-700 dark:text-amber-300" 
  },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role] || roleConfig.sales_rep;
  const Icon = config.icon;

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "font-medium gap-1.5 px-2.5 py-1",
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}
