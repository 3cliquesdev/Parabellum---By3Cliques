import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Building2, Plus } from "lucide-react";
import { useDeals } from "@/hooks/useDeals";
import DealDialog from "./DealDialog";
import type { Tables } from "@/integrations/supabase/types";

type Conversation = Tables<"conversations"> & {
  contacts: Tables<"contacts"> & {
    organizations: Tables<"organizations"> | null;
  };
};

interface ContactDetailsSidebarProps {
  conversation: Conversation | null;
}

export default function ContactDetailsSidebar({ conversation }: ContactDetailsSidebarProps) {
  const { data: allDeals } = useDeals();
  
  if (!conversation) {
    return (
      <div className="w-80 border-l border-border bg-card p-6">
        <p className="text-muted-foreground text-center">
          Selecione uma conversa
        </p>
      </div>
    );
  }

  const contact = conversation.contacts;
  const contactDeals = allDeals?.filter(
    (deal) => deal.contact_id === contact.id
  );

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Contact Info */}
          <div className="flex flex-col items-center mb-6">
            <Avatar className="h-20 w-20 bg-primary/10 flex items-center justify-center mb-3">
              <span className="text-2xl font-semibold text-primary">
                {contact.first_name[0]}
                {contact.last_name[0]}
              </span>
            </Avatar>
            <h3 className="text-lg font-semibold text-foreground text-center">
              {contact.first_name} {contact.last_name}
            </h3>
          </div>

          <Separator className="my-4" />

          {/* Contact Details */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                Informações de Contato
              </p>
              {contact.email && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{contact.phone}</span>
                </div>
              )}
            </div>

            {contact.organizations && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    Organização
                  </p>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">
                      {contact.organizations.name}
                    </span>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Deals */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Negócios ({contactDeals?.length || 0})
                </p>
                <DealDialog
                  prefilledContactId={contact.id}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-7 gap-1">
                      <Plus className="h-3 w-3" />
                      Criar
                    </Button>
                  }
                />
              </div>
              {contactDeals && contactDeals.length > 0 ? (
                <div className="space-y-2">
                  {contactDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground mb-1">
                        {deal.title}
                      </p>
                      {deal.value && (
                        <p className="text-sm font-bold text-success">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: deal.currency || "BRL",
                          }).format(deal.value)}
                        </p>
                      )}
                      <Badge
                        variant={
                          deal.status === "won"
                            ? "default"
                            : deal.status === "lost"
                            ? "destructive"
                            : "secondary"
                        }
                        className="mt-2"
                      >
                        {deal.status === "open"
                          ? "Aberto"
                          : deal.status === "won"
                          ? "Ganho"
                          : "Perdido"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum negócio associado
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
