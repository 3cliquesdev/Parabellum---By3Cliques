import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerTimeline } from "@/hooks/useCustomerTimeline";
import { useCustomerTags } from "@/hooks/useCustomerTags";
import { useDeals } from "@/hooks/useDeals";
import { useUserRole } from "@/hooks/useUserRole";
import { useCreateInteraction } from "@/hooks/useCreateInteraction";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, MessageSquare } from "lucide-react";
import CustomerTimeline from "@/components/CustomerTimeline";
import ContactInfoCard from "@/components/ContactInfoCard";
import ContactLTVCard from "@/components/ContactLTVCard";
import ContactTagsCard from "@/components/ContactTagsCard";
import ActivityDialog from "@/components/ActivityDialog";
import ActivitiesList from "@/components/ActivitiesList";
import OnboardingJourneyCard from "@/components/OnboardingJourneyCard";
import OnboardingSummaryCard from "@/components/OnboardingSummaryCard";
import SuccessVisionCard from "@/components/SuccessVisionCard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export default function ContactDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useUserRole();
  const { toast } = useToast();
  const createInteraction = useCreateInteraction();
  const [touchpointNote, setTouchpointNote] = useState("");
  const [touchpointDialogOpen, setTouchpointDialogOpen] = useState(false);

  const isConsultant = role === "consultant";
  
  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      if (!id) throw new Error("ID não fornecido");
      const { data, error } = await supabase
        .from("contacts")
        .select("*, organizations(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: timeline, isLoading: isLoadingTimeline } = useCustomerTimeline(id || null);
  const { data: tags, isLoading: isLoadingTags, addTag, removeTag } = useCustomerTags(id || null);
  const { data: allDeals } = useDeals();
  
  const contactDeals = allDeals?.filter(d => d.contact_id === id) || [];

  const handleRegisterTouchpoint = async () => {
    if (!id || !touchpointNote.trim()) return;

    try {
      await createInteraction.mutateAsync({
        customer_id: id,
        type: "meeting",
        content: touchpointNote,
        channel: "meeting",
        metadata: { touchpoint_type: "QBR" },
      });

      toast({
        title: "Touchpoint registrado",
        description: "Interação adicionada ao histórico do cliente.",
      });

      setTouchpointNote("");
      setTouchpointDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao registrar touchpoint",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (isLoadingContact) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Contato não encontrado</p>
          <Button onClick={() => navigate("/contacts")} className="mt-4">
            Voltar para Contatos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(isConsultant ? "/my-portfolio" : "/contacts")}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {isConsultant ? "Voltar para Minha Carteira" : "Voltar para Contatos"}
        </Button>

        <div className="flex gap-6 h-[calc(100vh-180px)]">
          {/* COLUNA ESQUERDA: 30% */}
          <div className="w-[30%] space-y-6 overflow-auto">
            <ContactInfoCard contact={contact} />
            
            {/* Show LTV only for non-consultants (sales team) */}
            {!isConsultant && <ContactLTVCard contact={contact} deals={contactDeals} />}
            
            {/* Highlight Onboarding for consultants */}
            <OnboardingSummaryCard contactId={id || ""} />
            
            <ContactTagsCard 
              customerId={id || ""} 
              customerTags={tags} 
              addTag={addTag}
              removeTag={removeTag}
              isLoading={isLoadingTags}
            />
            
            {/* Show "Nova Atividade" only for non-consultants */}
            {!isConsultant && (
              <ActivityDialog
                trigger={
                  <Button className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Atividade
                  </Button>
                }
                contactId={id}
              />
            )}

            {/* Show "Registrar Touchpoint" for consultants */}
            {isConsultant && (
              <Dialog open={touchpointDialogOpen} onOpenChange={setTouchpointDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full gap-2" variant="default">
                    <MessageSquare className="h-4 w-4" />
                    Registrar Touchpoint
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Touchpoint</DialogTitle>
                    <DialogDescription>
                      Documente uma reunião de acompanhamento, QBR ou outra interação importante com o cliente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Textarea
                      placeholder="Ex: QBR realizada. Cliente satisfeito com o produto. Discutimos possível expansão de uso..."
                      value={touchpointNote}
                      onChange={(e) => setTouchpointNote(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTouchpointDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleRegisterTouchpoint} disabled={!touchpointNote.trim()}>
                      Registrar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* COLUNA DIREITA: 70% */}
          <div className="flex-1 space-y-6 overflow-auto">
            {/* 🌟 Dossiê de Sucesso - PRIMEIRA COISA PARA TODOS */}
            <SuccessVisionCard contactId={id || ""} />
            
            {/* Highlight Onboarding Journey for consultants */}
            {isConsultant && <OnboardingJourneyCard contactId={id || ""} />}
            
            {/* Show Activities for all users */}
            <ActivitiesList contactId={id || ""} />
            
            {/* Show Onboarding Journey again for non-consultants (lower priority) */}
            {!isConsultant && <OnboardingJourneyCard contactId={id || ""} />}
            
            {/* Timeline for all */}
            <CustomerTimeline 
              timeline={timeline || []} 
              customerName={`${contact.first_name} ${contact.last_name}`}
              isLoading={isLoadingTimeline}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
