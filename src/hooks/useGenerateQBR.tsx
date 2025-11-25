import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QBRData {
  contactId: string;
  contactName: string;
  companyName: string;
  period: string;
}

export function useGenerateQBR() {
  return useMutation({
    mutationFn: async (data: QBRData) => {
      console.log("🎯 Generating QBR report for:", data.contactName);

      // Buscar dados do cliente
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select(`
          *,
          customer_journey_steps(*)
        `)
        .eq("id", data.contactId)
        .single();

      if (contactError) throw contactError;

      // Buscar interações do período
      const { data: interactions, error: interactionsError } = await supabase
        .from("interactions")
        .select("*")
        .eq("customer_id", data.contactId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (interactionsError) throw interactionsError;

      // Buscar tickets do período
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .eq("customer_id", data.contactId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (ticketsError) throw ticketsError;

      // Calcular métricas
      const onboardingProgress = contact.customer_journey_steps?.length 
        ? Math.round((contact.customer_journey_steps.filter((s: any) => s.completed).length / contact.customer_journey_steps.length) * 100)
        : 100;

      const openTickets = tickets?.filter(t => t.status !== "closed").length || 0;
      const resolvedTickets = tickets?.filter(t => t.status === "closed").length || 0;

      // Calcular health score baseado em last_contact_date
      const daysSinceContact = contact.last_contact_date 
        ? Math.floor((new Date().getTime() - new Date(contact.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let healthScore = "yellow";
      if (daysSinceContact <= 7) healthScore = "green";
      else if (daysSinceContact > 30) healthScore = "red";

      const healthLabel = healthScore === "green" ? "Saudável" : healthScore === "yellow" ? "Atenção" : "Crítico";

      // Montar dados do relatório
      const reportData = {
        clientName: `${contact.first_name} ${contact.last_name}`,
        companyName: contact.company || "N/A",
        period: data.period,
        generatedAt: new Date().toLocaleDateString("pt-BR"),
        metrics: {
          healthScore: healthLabel,
          onboardingProgress: `${onboardingProgress}%`,
          totalInteractions: interactions?.length || 0,
          openTickets,
          resolvedTickets,
          subscriptionPlan: contact.subscription_plan || "N/A",
          accountBalance: contact.account_balance ? `R$ ${contact.account_balance.toLocaleString("pt-BR")}` : "R$ 0",
          recentOrders: contact.recent_orders_count || 0,
          totalLTV: contact.total_ltv ? `R$ ${contact.total_ltv.toLocaleString("pt-BR")}` : "R$ 0",
        },
        recentActivities: interactions?.slice(0, 5).map(i => ({
          date: new Date(i.created_at!).toLocaleDateString("pt-BR"),
          type: i.type,
          channel: i.channel,
          content: i.content.substring(0, 100),
        })) || [],
        supportSummary: {
          total: tickets?.length || 0,
          open: openTickets,
          resolved: resolvedTickets,
          avgResolutionTime: "2.5 dias", // Mock - seria calculado com dados reais
        },
      };

      console.log("✅ QBR report data compiled:", reportData);
      return reportData;
    },
    onSuccess: (data) => {
      console.log("✅ QBR generated successfully");
      
      // Por enquanto, vamos apenas logar os dados
      // Em produção, isso geraria um PDF real
      toast.success("Relatório QBR gerado com sucesso!", {
        description: "Os dados foram compilados. (PDF generation em desenvolvimento)",
      });

      // Baixar como JSON por enquanto (mock do PDF)
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `QBR_${data.clientName.replace(/\s+/g, "_")}_${data.period}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    onError: (error) => {
      console.error("❌ Error generating QBR:", error);
      toast.error("Erro ao gerar relatório QBR");
    },
  });
}
