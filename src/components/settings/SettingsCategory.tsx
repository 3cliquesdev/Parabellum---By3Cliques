import { LucideIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SettingsCategoryProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}

export function SettingsCategory({
  title,
  icon: Icon,
  iconColor = "text-primary",
  children,
  defaultOpen = true,
  badge,
}: SettingsCategoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full group">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-muted", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
