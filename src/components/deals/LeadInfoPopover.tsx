import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MessageSquare, User, Building } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string; phone?: string | null; email?: string | null } | null;
  organizations: { name: string } | null;
};

interface LeadInfoPopoverProps {
  deal: Deal;
}

export default function LeadInfoPopover({ deal }: LeadInfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Dados do contato vinculado ou do lead direto no deal
  const name = deal.contacts
    ? `${deal.contacts.first_name} ${deal.contacts.last_name}`
    : null;
  const email = deal.contacts?.email || (deal as any).lead_email || null;
  const phone = deal.contacts?.phone || (deal as any).lead_phone || null;
  const source = (deal as any).lead_source || null;
  const organization = deal.organizations?.name || null;

  const hasAnyInfo = name || email || phone;

  const formatWhatsAppNumber = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55") && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      return `55${cleanPhone}`;
    }
    return cleanPhone;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: `${label} copiado`,
        description: `${text} copiado para a área de transferência`,
      });
    } catch (error) {
      console.error("Erro ao copiar:", error);
    }
  };

  if (!hasAnyInfo) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-1.5 text-xs font-bold text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          360
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm text-foreground">
              {deal.contacts ? "Contato" : "Lead"}
            </h4>
            {source && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {source}
              </Badge>
            )}
          </div>
          {name && <p className="text-sm text-foreground">{name}</p>}
          {!name && <p className="text-xs text-muted-foreground">Sem nome vinculado</p>}
        </div>

        <div className="p-4 space-y-3">
          {/* Email */}
          {email && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate">{email}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => copyToClipboard(email, "Email")}
              >
                <Mail className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Phone */}
          {phone && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate">{phone}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => {
                    const formattedPhone = formatWhatsAppNumber(phone);
                    window.open(`https://wa.me/${formattedPhone}`, "_blank");
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    if (window.innerWidth > 768) {
                      copyToClipboard(phone, "Telefone");
                    } else {
                      window.open(`tel:${phone}`, "_blank");
                    }
                  }}
                >
                  <Phone className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Organization */}
          {organization && (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{organization}</span>
            </div>
          )}
        </div>

        {!email && !phone && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nenhuma informação de contato disponível
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
