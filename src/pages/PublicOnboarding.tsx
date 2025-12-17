import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThankYouView } from "@/components/public-onboarding/ThankYouView";
import { WizardView } from "@/components/public-onboarding/WizardView";
import { WhatsAppFloatingButton } from "@/components/public-onboarding/WhatsAppFloatingButton";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
  const { executionId, playbookId } = useParams<{ executionId?: string; playbookId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [started, setStarted] = useState(false);
  const [playbookInfo, setPlaybookInfo] = useState<{ name: string; description?: string; support_phone?: string } | null>(null);
  
  // Form state for starting playbook - REMOVED email/name requirement
  const [isStarting, setIsStarting] = useState(false);
  
  // Query params for personalization
  const customName = searchParams.get("name");
  const customProduct = searchParams.get("product");
  const supportPhone = playbookInfo?.support_phone || searchParams.get("phone") || "5511999999999";

  useEffect(() => {
    if (executionId) {
      loadOnboardingData();
    } else if (playbookId) {
      loadPlaybookInfo();
    } else {
      setError("Link inválido");
      setLoading(false);
    }
  }, [executionId, playbookId]);

  async function loadPlaybookInfo() {
    try {
      const { data: playbook, error: playbookError } = await supabase
        .from("onboarding_playbooks")
        .select("name, description, support_phone")
        .eq("id", playbookId)
        .single();

      if (playbookError) throw playbookError;
      if (!playbook) throw new Error("Playbook não encontrado");

      setPlaybookInfo(playbook);
    } catch (err: any) {
      console.error("Error loading playbook info:", err);
      setError(err.message || "Erro ao carregar informações do playbook");
    } finally {
      setLoading(false);
    }
  }

  async function loadOnboardingData() {
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

  async function handleStartPlaybook() {
    if (!playbookId) return;

    setIsStarting(true);

    try {
      // Start playbook without collecting user info - creates anonymous execution
      const { data: result, error } = await supabase.functions.invoke('public-start-playbook', {
        body: {
          playbook_id: playbookId,
          // Create anonymous contact with unique identifier
          email: `anon_${Date.now()}@playbook.temp`,
          first_name: "Visitante",
          last_name: "",
        },
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || "Erro ao iniciar playbook");

      toast({
        title: "Iniciando sua jornada!",
        description: "Redirecionando...",
      });

      // Redirect to execution page
      navigate(`/public-onboarding/${result.execution_id}`);
    } catch (err: any) {
      console.error("Error starting playbook:", err);
      toast({
        title: "Erro ao iniciar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  }

  const displayName = customName || `${data?.contact?.first_name || ""} ${data?.contact?.last_name || ""}`.trim() || "Cliente";
  const productName = customProduct || playbookInfo?.name || data?.playbook?.name || "nosso produto";

  // Se acessou via playbookId (link público do playbook)
  if (playbookId && !executionId) {
    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      );
    }

    if (error || !playbookInfo) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">😕</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Playbook não encontrado</h1>
            <p className="text-muted-foreground">{error || "Este playbook não existe ou foi removido."}</p>
          </div>
        </div>
      );
    }

    // Public playbook start page - Clean design without form fields
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
        <div className="bg-card/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 max-w-md w-full text-center border border-border/50">
          {/* Icon/Logo */}
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/20">
            <Play className="w-12 h-12 text-primary-foreground" />
          </div>
          
          {/* Title */}
          <h1 className="text-3xl font-bold text-foreground mb-4 tracking-tight">
            {playbookInfo.name}
          </h1>
          
          {/* Description */}
          {playbookInfo.description && (
            <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
              {playbookInfo.description}
            </p>
          )}

          {/* CTA Button - No form, direct action */}
          <Button
            onClick={handleStartPlaybook}
            disabled={isStarting}
            size="lg"
            className="w-full h-14 text-lg font-semibold rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Preparando...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Iniciar sua Jornada
              </>
            )}
          </Button>

          {/* Footer text */}
          <p className="text-xs text-muted-foreground mt-6">
            Ao continuar, você concorda com nossos termos de uso.
          </p>
        </div>
        <WhatsAppFloatingButton phone={supportPhone} customerName="Visitante" />
      </div>
    );
  }

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
