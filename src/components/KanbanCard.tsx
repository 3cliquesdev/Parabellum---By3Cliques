import { useDraggable } from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, MessageSquare, Phone, FileText, ArrowRightLeft, Trash2, Star, Calendar, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteDeal } from "@/hooks/useDeals";
// useCreateConversation removed - now using PipelineTemplateDialog
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DealDialog from "./DealDialog";
import ContactSheet from "./ContactSheet";
import MoveToPipelineDialog from "./deals/MoveToPipelineDialog";
import LeadInfoPopover from "./deals/LeadInfoPopover";
import { PipelineTemplateDialog } from "./pipeline/PipelineTemplateDialog";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string; phone?: string | null; email?: string | null } | null;
  organizations: { name: string } | null;
  assigned_user: { id: string; full_name: string; avatar_url: string | null } | null;
};

interface KanbanCardProps {
  deal: Deal;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (dealId: string, selected: boolean) => void;
}

export default function KanbanCard({ 
  deal, 
  isSelectionMode = false, 
  isSelected = false, 
  onSelectionChange 
}: KanbanCardProps) {
  const [showContactSheet, setShowContactSheet] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const deleteDeal = useDeleteDeal();
  // Template dialog handles conversation creation now
  const [isNavigatingToInbox, setIsNavigatingToInbox] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  // Format WhatsApp number with country code
  const formatWhatsAppNumber = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      return `55${cleanPhone}`;
    }
    return cleanPhone;
  };

  // Copy phone to clipboard
  const copyPhoneToClipboard = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({
        title: "Telefone copiado",
        description: `${phone} copiado para a área de transferência`,
      });
    } catch (error) {
      console.error('Erro ao copiar telefone:', error);
    }
  };

  const handleStartInboxConversation = async () => {
    if (!deal.contact_id) {
      toast({ title: "Sem contato", description: "Este deal não tem um contato vinculado.", variant: "destructive" });
      return;
    }
    setIsNavigatingToInbox(true);
    try {
      // Check for existing open conversation
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", deal.contact_id)
        .eq("status", "open")
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Active conversation exists - navigate directly
        navigate(`/inbox?conversation=${existing.id}`);
      } else {
        // No active conversation - show template selector
        setShowTemplateDialog(true);
      }
    } catch (error) {
      console.error("Erro ao iniciar conversa:", error);
    } finally {
      setIsNavigatingToInbox(false);
    }
  };
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: {
      deal,
    },
    disabled: isSelectionMode,
  });
  
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  // Check if deal is rotten (stagnant)
  const isRottenDeal = () => {
    if (deal.status !== "open") return false;
    const daysSinceUpdate = differenceInDays(new Date(), new Date(deal.updated_at));
    return daysSinceUpdate > 14;
  };

  const isRotten = isRottenDeal();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: deal.currency || 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative bg-background rounded-xl p-4 transition-all duration-200",
          "border border-border/50 hover:border-border",
          "shadow-sm hover:shadow-md",
          isSelectionMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
          isRotten && "border-l-4 border-l-destructive",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
        onClick={() => {
          if (isSelectionMode) {
            onSelectionChange?.(deal.id, !isSelected);
          }
        }}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <div 
            className="absolute top-3 left-3 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange?.(deal.id, !!checked)}
              className="h-4 w-4"
            />
          </div>
        )}

        {/* Edit button - appears on hover */}
        <DealDialog
          deal={deal}
          trigger={
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />

        {/* Main draggable area */}
        <div {...listeners} {...attributes} className={cn("space-y-2", isSelectionMode && "pl-6")}>
          {/* Line 1: Deal Title + Returning Customer Badge */}
          <div className="flex items-center gap-1.5">
            <h4 className="font-medium text-sm text-foreground line-clamp-1 pr-8 flex-1" title={deal.title}>
              {deal.title}
            </h4>
            
            {/* Badge de Cliente Existente */}
            {(deal as any).is_returning_customer && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 h-4 flex-shrink-0 gap-0.5"
                    >
                      <Star className="h-2.5 w-2.5 fill-amber-500" />
                      Cliente
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">
                    <p className="font-medium mb-1">Já possui:</p>
                    <ul className="text-xs list-disc pl-3">
                      {((deal as any).existing_products || []).map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground mt-1 pt-1 border-t">Oportunidade de upsell!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Line 2: Contact name (clickable) + Value */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {deal.contacts ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContactSheet(true);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-xs text-primary hover:underline text-left truncate block max-w-full"
                >
                  {deal.contacts.first_name} {deal.contacts.last_name}
                </button>
              ) : (deal as any).lead_email ? (
                <p className="text-xs text-muted-foreground truncate">
                  {(deal as any).lead_email}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Sem contato</p>
              )}
            </div>
            
            {/* Value - neutral color, not green */}
            {deal.value && (
              <span className="text-xs font-semibold text-foreground tabular-nums flex-shrink-0">
                {formatCurrency(deal.value)}
              </span>
            )}
          </div>

          {/* Line 3: Sales Rep + Date */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {deal.assigned_user ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Avatar className="h-5 w-5 flex-shrink-0">
                  <AvatarImage 
                    src={deal.assigned_user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${deal.assigned_user.full_name}`} 
                    alt={deal.assigned_user.full_name} 
                  />
                  <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                    {deal.assigned_user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate">
                  {deal.assigned_user.full_name}
                </span>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            
            {/* Data de criação */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(deal.created_at), "dd/MM/yy", { locale: ptBR })}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Criado em {format(new Date(deal.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Quick Actions - hidden by default, show on hover */}
        <div 
          className="flex items-center gap-0.5 pt-2 mt-2 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Lead Info 360 */}
          <LeadInfoPopover deal={deal} />
          
          {/* Move to Pipeline */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div onPointerDown={(e) => e.stopPropagation()}>
                  <MoveToPipelineDialog
                    deal={deal}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>Mover para outro Pipeline</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Create Quote */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/quotes/new?deal_id=${deal.id}`);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Criar Proposta</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Inbox - Iniciar Conversa */}
          {deal.contact_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    disabled={isNavigatingToInbox}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartInboxConversation();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Inbox className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir no Inbox</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {deal.contacts?.phone && (
            <>
              {/* WhatsApp */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-green-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        const formattedPhone = formatWhatsAppNumber(deal.contacts?.phone || '');
                        window.open(`https://wa.me/${formattedPhone}`, '_blank');
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>WhatsApp</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Phone */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.innerWidth > 768) {
                          copyPhoneToClipboard(deal.contacts?.phone || '');
                        } else {
                          window.open(`tel:${deal.contacts?.phone}`, '_blank');
                        }
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {window.innerWidth > 768 ? 'Copiar Telefone' : 'Ligar'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}

          {/* Delete Deal */}
          <AlertDialog>
            <TooltipProvider>
              <Tooltip>
                <AlertDialogTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive ml-auto"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                </AlertDialogTrigger>
                <TooltipContent>Excluir Negócio</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir negócio?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir "{deal.title}"? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    deleteDeal.mutate(deal.id);
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Contact Sheet */}
      <ContactSheetWrapper
        contactId={deal.contact_id}
        open={showContactSheet}
        onOpenChange={setShowContactSheet}
      />

      {/* Pipeline Template Dialog */}
      {deal.contact_id && deal.contacts?.phone && (
        <PipelineTemplateDialog
          open={showTemplateDialog}
          onOpenChange={setShowTemplateDialog}
          contactId={deal.contact_id}
          contactPhone={deal.contacts.phone}
          contactName={`${deal.contacts.first_name} ${deal.contacts.last_name}`}
          onConversationCreated={(conversationId) => {
            navigate(`/inbox?conversation=${conversationId}`);
          }}
        />
      )}
    </>
  );
}

// Wrapper component to fetch contact data
function ContactSheetWrapper({ 
  contactId, 
  open, 
  onOpenChange 
}: { 
  contactId: string | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
}) {
  const { data: contact } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("*, organizations(name)")
        .eq("id", contactId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contactId && open,
  });

  if (!contactId || !open) return null;

  return (
    <ContactSheet
      contact={contact}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
