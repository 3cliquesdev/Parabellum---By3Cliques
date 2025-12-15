import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThankYouView } from "@/components/public-onboarding/ThankYouView";
import { WizardView } from "@/components/public-onboarding/WizardView";
import { WhatsAppFloatingButton } from "@/components/public-onboarding/WhatsAppFloatingButton";
import { Loader2 } from "lucide-react";

interface OnboardingData {
  execution: {
    id: string;
    status: string;
    contact_id: string;
  };
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  steps: Array<{
    id: string;
    step_name: string;
    position: number;
    completed: boolean;
    is_critical: boolean;
    video_url?: string;
    rich_content?: string;
    quiz_enabled?: boolean;
    quiz_question?: string;
    quiz_options?: any;
    quiz_correct_option?: string;
    quiz_passed?: boolean;
    attachments?: any;
  }>;
  playbook?: {
    name: string;
  };
}

export default function PublicOnboarding() {
  const { executionId } = useParams<{ executionId: string }>();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [started, setStarted] = useState(false);
  
  // Query params for personalization
  const customName = searchParams.get("name");
  const customProduct = searchParams.get("product");
  const supportPhone = searchParams.get("phone") || "5511999999999";

  useEffect(() => {
    loadOnboardingData();
  }, [executionId]);

  async function loadOnboardingData() {
    if (!executionId) {
      setError("ID de execução não fornecido");
      setLoading(false);
      return;
    }

    try {
      // Fetch execution
      const { data: execution, error: execError } = await supabase
        .from("playbook_executions")
        .select(`
          id, status, contact_id,
          playbooks:playbook_id (name)
        `)
        .eq("id", executionId)
        .single();

      if (execError) throw execError;
      if (!execution) throw new Error("Execução não encontrada");

      // Fetch contact
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .eq("id", execution.contact_id)
        .single();

      if (contactError) throw contactError;

      // Fetch journey steps
      const { data: steps, error: stepsError } = await supabase
        .from("customer_journey_steps")
        .select("*")
        .eq("contact_id", execution.contact_id)
        .order("position", { ascending: true });

      if (stepsError) throw stepsError;

      // Check if any step is already completed (means user already started)
      const hasProgress = steps?.some(s => s.completed);

      setData({
        execution: {
          id: execution.id,
          status: execution.status,
          contact_id: execution.contact_id,
        },
        contact: contact!,
        steps: steps || [],
        playbook: execution.playbooks as any,
      });
      
      setStarted(hasProgress);
    } catch (err: any) {
      console.error("Error loading onboarding data:", err);
      setError(err.message || "Erro ao carregar dados do onboarding");
    } finally {
      setLoading(false);
    }
  }

  const displayName = customName || `${data?.contact?.first_name || ""} ${data?.contact?.last_name || ""}`.trim() || "Cliente";
  const productName = customProduct || data?.playbook?.name || "nosso produto";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando seu onboarding...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Ops! Algo deu errado</h1>
          <p className="text-muted-foreground mb-6">{error || "Não foi possível carregar o onboarding."}</p>
          <a
            href={`https://wa.me/${supportPhone}?text=Olá! Preciso de ajuda com meu onboarding.`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium transition-all"
          >
            Falar com Suporte no WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {!started ? (
        <ThankYouView
          customerName={displayName}
          productName={productName}
          supportPhone={supportPhone}
          onStart={() => setStarted(true)}
        />
      ) : (
        <WizardView
          steps={data.steps}
          customerName={displayName}
          contactId={data.contact.id}
          supportPhone={supportPhone}
          onRefresh={loadOnboardingData}
        />
      )}
      
      <WhatsAppFloatingButton
        phone={supportPhone}
        customerName={displayName}
      />
    </div>
  );
}
