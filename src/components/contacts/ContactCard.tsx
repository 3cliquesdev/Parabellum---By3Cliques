import { Badge } from "@/components/ui/badge";
import { Mail, Phone, ChevronRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations?: { name: string } | null;
};

interface ContactCardProps {
  contact: Contact;
  onClick?: () => void;
}

export function ContactCard({ contact, onClick }: ContactCardProps) {
  return (
    <div
      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
        {displayInitials(contact.first_name, contact.last_name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {displayName(contact.first_name, contact.last_name)}
        </p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
          {contact.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{contact.email}</span>
            </span>
          )}
          {contact.phone && !contact.email && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {contact.phone}
            </span>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {contact.blocked ? (
          <Badge variant="destructive" className="text-xs">
            Bloqueado
          </Badge>
        ) : (
          <Badge variant="default" className="bg-green-500 text-xs">
            Ativo
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
