import { useDraggable } from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, AlertCircle, CheckCircle, AlertTriangle, Skull, MessageSquare, Phone, FileText } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import DealDialog from "./DealDialog";
import ContactSheet from "./ContactSheet";
import { useNextActivity } from "@/hooks/useNextActivity";
import { useCustomerTags } from "@/hooks/useCustomerTags";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts: { first_name: string; last_name: string; phone?: string | null } | null;
  organizations: { name: string } | null;
  assigned_user: { id: string; full_name: string; avatar_url: string | null } | null;
};

interface KanbanCardProps {
  deal: Deal;
}

export default function KanbanCard({ deal }: KanbanCardProps) {
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
          "cursor-grab active:cursor-grabbing mb-3 hover:border-primary transition-all relative group",
          isRotten && "border-destructive border-2"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-4">
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
          
          {/* Ícone de Status de Atividade */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute top-2 left-2">
                  <ActivityIcon className={`h-5 w-5 ${activityStatus.color}`} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">{activityStatus.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Indicador Rotten Deal */}
          {isRotten && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute top-2 left-9">
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
            <h4 className="font-semibold text-foreground mb-2 pl-8 pr-8">{deal.title}</h4>

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

            {/* Contact Info - Clickable */}
            {deal.contacts && (
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
            )}

            {/* Organization */}
            {deal.organizations && (
              <Badge variant="secondary" className="mb-2">
                {deal.organizations.name}
              </Badge>
            )}

            {/* Bottom Row: Salesperson + Quick Actions */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
              {/* Assigned User */}
              {deal.assigned_user && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage 
                      src={deal.assigned_user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${deal.assigned_user.full_name}`} 
                      alt={deal.assigned_user.full_name} 
                    />
                    <AvatarFallback className="text-xs">
                      {deal.assigned_user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">{deal.assigned_user.full_name}</span>
                </div>
              )}

              {/* Quick Actions - Visible on Hover */}
              {isHovered && (
                <div 
                  className="flex items-center gap-1" 
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
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
                                // Desktop: copiar para clipboard, Mobile: tel: link
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
                </div>
              )}
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
