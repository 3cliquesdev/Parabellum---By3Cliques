import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpdateContact } from "@/hooks/useContacts";
import { useCustomerTimeline } from "@/hooks/useCustomerTimeline";
import { useCustomerTags } from "@/hooks/useCustomerTags";
import TimelineItem from "@/components/TimelineItem";
import { Phone, Mail, MessageSquare, Save, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContactSheetProps {
  contact: Tables<"contacts"> & { organizations?: { name: string } | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactSheet({ contact, open, onOpenChange }: ContactSheetProps) {
  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      first_name: contact?.first_name || "",
      last_name: contact?.last_name || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      company: contact?.company || "",
    },
  });

  const updateContact = useUpdateContact();
  const { data: timeline } = useCustomerTimeline(contact?.id || null);
  const { data: customerTags } = useCustomerTags(contact?.id || null);

  const onSubmit = (data: any) => {
    if (!contact) return;
    updateContact.mutate(
      { id: contact.id, updates: data },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  if (!contact) return null;

  const fullName = `${contact.first_name} ${contact.last_name}`;
  const initials = `${contact.first_name[0]}${contact.last_name[0]}`.toUpperCase();

  // Status badge configuration
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    lead: { label: "Lead", variant: "secondary" },
    customer: { label: "Cliente", variant: "default" },
    churned: { label: "Churn", variant: "destructive" },
    overdue: { label: "Inadimplente", variant: "outline" },
  };

  const statusInfo = contact.status ? statusConfig[contact.status] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={contact.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-2xl">{fullName}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                {statusInfo && (
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                )}
                {customerTags?.slice(0, 3).map((ct: any) => (
                  <Badge
                    key={ct.tag_id}
                    variant="outline"
                    style={{ 
                      borderColor: ct.tags.color,
                      color: ct.tags.color 
                    }}
                  >
                    {ct.tags.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <SheetDescription>
            {contact.organizations?.name && `${contact.organizations.name} • `}
            Cliente desde {format(new Date(contact.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* Quick Actions */}
          <div className="flex gap-2 mb-6">
            {contact.phone && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(`https://wa.me/${contact.phone.replace(/\D/g, '')}`, '_blank')}
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </Button>
            )}
            {contact.phone && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(`tel:${contact.phone}`, '_blank')}
              >
                <Phone className="h-4 w-4" />
                Ligar
              </Button>
            )}
            {contact.email && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(`mailto:${contact.email}`, '_blank')}
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
            )}
          </div>

          <Separator className="my-4" />

          {/* Edit Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nome</Label>
                <Input id="first_name" {...register("first_name")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Sobrenome</Label>
                <Input id="last_name" {...register("last_name")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" {...register("phone")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input id="company" {...register("company")} />
            </div>

            {isDirty && (
              <Button type="submit" className="w-full gap-2" disabled={updateContact.isPending}>
                {updateContact.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Alterações
              </Button>
            )}
          </form>

          <Separator className="my-4" />

          {/* Timeline */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Histórico de Interações</h3>
            {timeline && timeline.length > 0 ? (
              <div className="space-y-3">
                {timeline.map((interaction) => (
                  <TimelineItem key={interaction.id} interaction={interaction} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Nenhuma interação registrada ainda.
              </p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
