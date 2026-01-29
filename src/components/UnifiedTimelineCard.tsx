import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  StickyNote, 
  Ticket, 
  DollarSign, 
  MessageCircle, 
  CheckCircle, 
  Loader2,
  MessageSquare,
  Bot,
  User,
  Search,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useUnifiedTimeline } from "@/hooks/useUnifiedTimeline";
import { useCreateInteraction } from "@/hooks/useCreateInteraction";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnifiedTimelineCardProps {
  contactId: string;
  onNavigateToConversation?: (conversationId: string) => void;
}

const TIMELINE_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  interaction: { icon: StickyNote, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ticket: { icon: Ticket, color: "text-purple-500", bg: "bg-purple-500/10" },
  deal: { icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
  conversation: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
  onboarding: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  message: { icon: MessageSquare, color: "text-slate-500", bg: "bg-slate-500/10" },
  note: { icon: StickyNote, color: "text-orange-500", bg: "bg-orange-500/10" },
};

export default function UnifiedTimelineCard({ contactId, onNavigateToConversation }: UnifiedTimelineCardProps) {
  const { data: timeline, isLoading } = useUnifiedTimeline(contactId);
  const createInteraction = useCreateInteraction();
  const [newNote, setNewNote] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllMessages, setShowAllMessages] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    createInteraction.mutate({
      customer_id: contactId,
      type: "note",
      content: newNote,
      channel: "other",
    }, {
      onSuccess: () => setNewNote("")
    });
  };

  // Filtrar e buscar na timeline
  const filteredTimeline = useMemo(() => {
    let filtered = timeline || [];
    
    // Filtro por tipo
    if (activeFilter !== "all") {
      filtered = filtered.filter(event => event.type === activeFilter);
    }
    
    // Busca textual (case-insensitive)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        (event.metadata?.full_content?.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [timeline, activeFilter, searchQuery]);

  // Agrupar mensagens por conversa para exibição compacta
  const displayTimeline = useMemo(() => {
    if (activeFilter === "message" || showAllMessages) {
      // Mostrar todas as mensagens quando filtro específico ou expandido
      return filteredTimeline;
    }
    
    // No modo "all", ocultar mensagens individuais (já estão resumidas nas conversas)
    return filteredTimeline?.filter(event => event.type !== "message");
  }, [filteredTimeline, activeFilter, showAllMessages]);

  // Contagem por tipo para badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (timeline || []).forEach(event => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    return counts;
  }, [timeline]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Histórico Completo</CardTitle>
          {timeline && (
            <Badge variant="secondary" className="text-xs">
              {timeline.length} registros
            </Badge>
          )}
        </div>
        
        {/* Busca */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar no histórico..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Note Input */}
        <div className="mb-4 p-3 border rounded-lg bg-muted/30">
          <Textarea 
            placeholder="Adicionar nota sobre o cliente..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="mb-2 min-h-[60px]"
            rows={2}
          />
          <Button 
            size="sm" 
            onClick={handleAddNote}
            disabled={!newNote.trim() || createInteraction.isPending}
          >
            {createInteraction.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <StickyNote className="h-4 w-4 mr-2" />
            )}
            Adicionar Nota
          </Button>
        </div>

        {/* Filters */}
        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-3">
          <TabsList className="grid grid-cols-7 w-full h-auto">
            <TabsTrigger value="all" className="text-xs px-1">Todos</TabsTrigger>
            <TabsTrigger value="message" className="text-xs px-1">
              Msgs {typeCounts.message ? `(${typeCounts.message})` : ''}
            </TabsTrigger>
            <TabsTrigger value="interaction" className="text-xs px-1">Notas</TabsTrigger>
            <TabsTrigger value="ticket" className="text-xs px-1">Tickets</TabsTrigger>
            <TabsTrigger value="deal" className="text-xs px-1">Deals</TabsTrigger>
            <TabsTrigger value="conversation" className="text-xs px-1">Chats</TabsTrigger>
            <TabsTrigger value="onboarding" className="text-xs px-1">Steps</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Toggle para mostrar mensagens no modo "all" */}
        {activeFilter === "all" && typeCounts.message > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllMessages(!showAllMessages)}
            className="mb-2 text-xs text-muted-foreground"
          >
            {showAllMessages ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Ocultar {typeCounts.message} mensagens individuais
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Mostrar {typeCounts.message} mensagens individuais
              </>
            )}
          </Button>
        )}

        {/* Timeline Feed */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayTimeline && displayTimeline.length > 0 ? (
            displayTimeline.map((event) => {
              const iconConfig = TIMELINE_ICONS[event.icon] || TIMELINE_ICONS[event.type] || TIMELINE_ICONS.interaction;
              const IconComponent = iconConfig.icon;
              const iconColor = iconConfig.color;
              const iconBg = iconConfig.bg;

              // Ícone especial para mensagens baseado no sender
              let FinalIcon = IconComponent;
              if (event.type === 'message' && event.metadata) {
                if (event.metadata.is_ai_generated) {
                  FinalIcon = Bot;
                } else if (event.metadata.sender_type === 'contact') {
                  FinalIcon = User;
                }
              }

              const isClickable = event.type === 'conversation' || 
                (event.type === 'message' && event.metadata?.conversation_id);

              return (
                <div 
                  key={event.id} 
                  className={`
                    flex gap-2 p-2 rounded-lg border bg-card transition-colors
                    ${isClickable ? 'hover:bg-muted/50 cursor-pointer' : ''}
                    ${event.type === 'message' ? 'py-1.5 border-dashed' : ''}
                  `}
                  onClick={() => {
                    if (onNavigateToConversation) {
                      if (event.type === 'conversation') {
                        onNavigateToConversation(event.id);
                      } else if (event.type === 'message' && event.metadata?.conversation_id) {
                        onNavigateToConversation(event.metadata.conversation_id);
                      }
                    }
                  }}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full ${iconBg} flex items-center justify-center`}>
                    <FinalIcon className={`h-4 w-4 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-medium text-foreground ${event.type === 'message' ? 'text-xs' : 'text-sm'}`}>
                        {event.title}
                      </h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.date), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className={`text-muted-foreground mt-0.5 ${event.type === 'message' ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'}`}>
                      {event.description}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">
                {searchQuery ? 'Nenhum resultado para a busca' : 'Nenhum evento encontrado'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
