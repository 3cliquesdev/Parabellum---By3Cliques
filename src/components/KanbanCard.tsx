import { useDraggable } from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, AlertCircle, CheckCircle, AlertTriangle, Skull, MessageSquare, Phone, FileText, ArrowRightLeft, Trash2 } from "lucide-react";
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
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import DealDialog from "./DealDialog";
import ContactSheet from "./ContactSheet";
import MoveToPipelineDialog from "./deals/MoveToPipelineDialog";
import LeadInfoPopover from "./deals/LeadInfoPopover";
import { useNextActivity } from "@/hooks/useNextActivity";
import { useCustomerTags } from "@/hooks/useCustomerTags";
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
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const deleteDeal = useDeleteDeal();
  
  // Formatar número WhatsApp com código do país
  const formatWhatsAppNumber = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    // Se não começa com 55 e tem 10-11 dígitos, adiciona 55
    if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      return `55${cleanPhone}`;
    }
    return cleanPhone;
  };

  // Copiar telefone para clipboard
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
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: {
      deal,
    },
    disabled: isSelectionMode, // Disable drag when in selection mode
  });

  const { data: nextActivity } = useNextActivity(deal.id);
  const { data: customerTags } = useCustomerTags(deal.contact_id);
  
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const getActivityStatus = () => {
    if (!nextActivity) {
      return {
        icon: AlertTriangle,
        color: "text-yellow-500",
        tooltip: "Nenhuma atividade agendada",
      };
    }

    const now = new Date();
    const dueDate = new Date(nextActivity.due_date);
    const isOverdue = dueDate < now;

    if (isOverdue) {
      return {
        icon: AlertCircle,
        color: "text-destructive",
        tooltip: `Atividade atrasada: ${nextActivity.title} (${format(dueDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })})`,
      };
    }

    return {
      icon: CheckCircle,
      color: "text-green-500",
      tooltip: `Próxima atividade: ${nextActivity.title} (${format(dueDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })})`,
    };
  };

  const activityStatus = getActivityStatus();
  const ActivityIcon = activityStatus.icon;

  // Verificar se é Rotten Deal
  const isRottenDeal = () => {
    if (deal.status !== "open") return false;

    const daysSinceUpdate = differenceInDays(new Date(), new Date(deal.updated_at));
    
    if (!nextActivity) {
      return daysSinceUpdate > 14;
    }

    const daysSinceActivity = differenceInDays(new Date(), new Date(nextActivity.due_date));
    return daysSinceUpdate > 14 || daysSinceActivity > 7;
  };

  const isRotten = isRottenDeal();

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "mb-3 transition-all relative group",
          isSelectionMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
          "hover:border-primary/50 dark:hover:border-primary/30",
          "dark:bg-white/[0.02] dark:border-white/5",
          isRotten && "border-destructive/50 dark:border-destructive/30 border-2",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (isSelectionMode) {
            onSelectionChange?.(deal.id, !isSelected);
          }
        }}
      >
        <CardContent className="p-4">
          {/* Selection Checkbox */}
          {isSelectionMode && (
            <div 
              className="absolute top-2 left-2 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectionChange?.(deal.id, !!checked)}
                className="h-5 w-5"
              />
            </div>
          )}
          <DealDialog
            deal={deal}
            trigger={
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          
          {/* Ícone de Status de Atividade - move right when in selection mode */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("absolute top-2", isSelectionMode ? "left-9" : "left-2")}>
                  <ActivityIcon className={`h-5 w-5 ${activityStatus.color}`} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">{activityStatus.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Indicador Rotten Deal - adjust position based on selection mode */}
          {isRotten && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn("absolute top-2", isSelectionMode ? "left-16" : "left-9")}>
                    <Badge variant="destructive" className="gap-1 px-1.5 py-0.5">
                      <Skull className="h-3 w-3" />
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">⚠️ Negócio estagnado há {differenceInDays(new Date(), new Date(deal.updated_at))} dias sem atividade</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Badge Lost Reason */}
          {deal.status === "lost" && (deal as any).lost_reason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mb-2">
                    <Badge variant="destructive" className="text-xs">
                      Perdido
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm font-semibold mb-1">Motivo da Perda:</p>
                  <p className="text-sm">{(deal as any).lost_reason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Área draggable */}
          <div {...listeners} {...attributes}>
            <h4 className="font-semibold text-foreground mb-2 pl-8 pr-8 line-clamp-2" title={deal.title}>{deal.title}</h4>

            {/* Customer Tags */}
            {customerTags && customerTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mb-2">
                {customerTags.slice(0, 3).map((ct: any) => (
                  <Badge
                    key={ct.tag_id}
                    variant="outline"
                    className="text-xs"
                    style={{ 
                      borderColor: ct.tags.color,
                      color: ct.tags.color,
                      backgroundColor: `${ct.tags.color}10`
                    }}
                  >
                    {ct.tags.name}
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Value - Destacado em Verde */}
            {deal.value && (
              <p className="text-lg font-bold text-green-600 mb-2">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: deal.currency || 'BRL',
                }).format(deal.value)}
              </p>
            )}

            {/* Contact/Lead Info */}
            {deal.contacts ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContactSheet(true);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-sm text-primary hover:underline text-left mb-1 block"
              >
                {deal.contacts.first_name} {deal.contacts.last_name}
              </button>
            ) : (deal as any).lead_email ? (
              <p className="text-sm text-muted-foreground mb-1 truncate">
                {(deal as any).lead_email}
              </p>
            ) : null}

            {/* Organization */}
            {deal.organizations && (
              <Badge variant="secondary" className="mb-2">
                {deal.organizations.name}
              </Badge>
            )}

            {/* Bottom Section: 2 linhas separadas */}
            <div className="pt-3 mt-3 border-t border-border space-y-2">
              {/* Linha 1: Vendedor */}
              {deal.assigned_user && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage 
                      src={deal.assigned_user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${deal.assigned_user.full_name}`} 
                      alt={deal.assigned_user.full_name} 
                    />
                    <AvatarFallback className="text-xs">
                      {deal.assigned_user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">{deal.assigned_user.full_name}</span>
                </div>
              )}

              {/* Linha 2: Quick Actions */}
              <div 
                className="flex items-center gap-1 flex-wrap" 
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Lead/Contact Info - 360 Badge - ALWAYS visible */}
                <LeadInfoPopover deal={deal} />
                
                {/* Move to Pipeline Button */}
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
                              className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Mover para outro Pipeline</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Create Quote Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/quotes/new?deal_id=${deal.id}`);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Criar Proposta</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {deal.contacts?.phone && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              const formattedPhone = formatWhatsAppNumber(deal.contacts?.phone || '');
                              window.open(`https://wa.me/${formattedPhone}`, '_blank');
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>WhatsApp</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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
                            <Phone className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {window.innerWidth > 768 ? 'Copiar Telefone' : 'Ligar'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}

                {/* Delete Deal Button */}
                <AlertDialog>
                  <TooltipProvider>
                    <Tooltip>
                      <AlertDialogTrigger asChild>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                      </AlertDialogTrigger>
                      <TooltipContent>Excluir Negociação</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Negociação</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir "{deal.title}"? 
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteDeal.mutate(deal.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Sheet */}
      {deal.contacts && (
        <ContactSheet
          contact={deal.contacts as any}
          open={showContactSheet}
          onOpenChange={setShowContactSheet}
        />
      )}
    </>
  );
}
