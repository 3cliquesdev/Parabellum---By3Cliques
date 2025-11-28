import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StickyNote, Ticket, DollarSign, MessageCircle, CheckCircle, Loader2 } from "lucide-react";
import { useUnifiedTimeline } from "@/hooks/useUnifiedTimeline";
import { useCreateInteraction } from "@/hooks/useCreateInteraction";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface UnifiedTimelineCardProps {
  contactId: string;
}

const TIMELINE_ICONS = {
  interaction: { icon: StickyNote, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ticket: { icon: Ticket, color: "text-purple-500", bg: "bg-purple-500/10" },
  deal: { icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
  conversation: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
  onboarding: { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

export default function UnifiedTimelineCard({ contactId }: UnifiedTimelineCardProps) {
  const { data: timeline, isLoading } = useUnifiedTimeline(contactId);
  const createInteraction = useCreateInteraction();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      await createInteraction.mutateAsync({
        customer_id: contactId,
        type: "note",
        content: newNote,
        channel: "other",
      });

      toast({
        title: "Nota adicionada",
        description: "A nota foi registrada com sucesso.",
      });

      setNewNote("");
    } catch (error) {
      toast({
        title: "Erro ao adicionar nota",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const filteredTimeline = activeFilter === "all" 
    ? timeline 
    : timeline?.filter(event => event.type === activeFilter);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Timeline do Cliente</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Note Input */}
        <div className="mb-6 p-4 border rounded-lg bg-muted/30">
          <Textarea 
            placeholder="Escrever nota rápida sobre o cliente..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="mb-2"
            rows={3}
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
        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-4">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="interaction">📝 Notas</TabsTrigger>
            <TabsTrigger value="ticket">🎫 Tickets</TabsTrigger>
            <TabsTrigger value="deal">💰 Deals</TabsTrigger>
            <TabsTrigger value="conversation">💬 Chats</TabsTrigger>
            <TabsTrigger value="onboarding">✅ Steps</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Timeline Feed */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTimeline && filteredTimeline.length > 0 ? (
            filteredTimeline.map((event) => {
              const IconComponent = TIMELINE_ICONS[event.type].icon;
              const iconColor = TIMELINE_ICONS[event.type].color;
              const iconBg = TIMELINE_ICONS[event.type].bg;

              return (
                <div 
                  key={event.id} 
                  className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
                    <IconComponent className={`h-5 w-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-foreground">{event.title}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum evento encontrado</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
