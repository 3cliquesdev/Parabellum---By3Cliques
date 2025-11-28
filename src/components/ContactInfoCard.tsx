import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Building2, Calendar, MessageCircle, MapPin, FileText } from "lucide-react";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

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
  const [showFullData, setShowFullData] = useState(false);

  const handleCall = () => {
    if (contact.phone) window.open(`tel:${contact.phone}`);
  };

  const handleWhatsApp = () => {
    if (contact.phone) {
      const cleanPhone = contact.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    }
  };

  const handleEmail = () => {
    if (contact.email) window.open(`mailto:${contact.email}`);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center mb-6">
          <Avatar className="h-28 w-28 mb-3">
            <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">
              {contact.first_name?.[0] || "?"}{contact.last_name?.[0] || ""}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold text-center text-foreground">
            {contact.first_name} {contact.last_name}
          </h2>
          {contact.company && (
            <p className="text-sm text-muted-foreground mt-1">{contact.company}</p>
          )}
          <Badge className={`mt-2 border ${statusInfo.className}`} variant="outline">
            {statusInfo.label}
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center gap-2 mb-6">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleCall}
            disabled={!contact.phone}
            title="Ligar"
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleWhatsApp}
            disabled={!contact.phone}
            className="text-green-500 hover:text-green-600"
            title="WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleEmail}
            disabled={!contact.email}
            title="Email"
          >
            <Mail className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            title="Agendar"
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>

        {/* Basic Info */}
        <div className="space-y-3 mb-4">
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

        {/* Collapsible Full Data */}
        <Collapsible open={showFullData} onOpenChange={setShowFullData}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" size="sm">
              <span className="text-sm font-medium">Dados Completos</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showFullData ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            {contact.document && (
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">CPF/CNPJ: {contact.document}</span>
              </div>
            )}
            
            {contact.birth_date && isValid(new Date(contact.birth_date)) && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">
                  Nascimento: {format(new Date(contact.birth_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}

            {(contact.address || contact.city || contact.state) && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-foreground">
                  {contact.address && <div>{contact.address}, {contact.address_number}</div>}
                  {contact.neighborhood && <div>{contact.neighborhood}</div>}
                  {(contact.city || contact.state) && (
                    <div>{contact.city}{contact.city && contact.state && ' - '}{contact.state}</div>
                  )}
                  {contact.zip_code && <div>CEP: {contact.zip_code}</div>}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
