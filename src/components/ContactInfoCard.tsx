import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Building2, Calendar } from "lucide-react";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

interface ContactInfoCardProps {
  contact: Tables<"contacts"> & {
    organizations: { name: string } | null;
  };
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  qualified: { label: "Qualificado", className: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  customer: { label: "Cliente", className: "bg-green-500/10 text-green-500 border-green-500/20" },
  inactive: { label: "Inativo", className: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
  churned: { label: "Churned", className: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export default function ContactInfoCard({ contact }: ContactInfoCardProps) {
  const statusInfo = STATUS_CONFIG[contact.status || "lead"];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center mb-6">
          <Avatar className="h-24 w-24 mb-3">
            <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
              {contact.first_name?.[0] || "?"}{contact.last_name?.[0] || ""}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold text-center text-foreground">
            {contact.first_name} {contact.last_name}
          </h2>
          <Badge className={`mt-2 border ${statusInfo.className}`} variant="outline">
            {statusInfo.label}
          </Badge>
        </div>

        <div className="space-y-3">
          {contact.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground break-all">{contact.email}</span>
            </div>
          )}
          
          {contact.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{contact.phone}</span>
            </div>
          )}

          {contact.organizations && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{contact.organizations.name}</span>
            </div>
          )}

          {contact.last_contact_date && isValid(new Date(contact.last_contact_date)) && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                Último contato: {format(new Date(contact.last_contact_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
