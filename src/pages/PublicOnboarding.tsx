import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

  // Enable body scroll for public pages
  useEffect(() => {
    document.documentElement.classList.add('allow-body-scroll');
    return () => {
      document.documentElement.classList.remove('allow-body-scroll');
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [playbookInfo, setPlaybookInfo] = useState<{ name: string; description?: string; support_phone?: string } | null>(null);
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
        .eq("is_active", true)
        .maybeSingle();

      if (playbookError) throw playbookError;
      if (!playbook) throw new Error("Playbook não encontrado ou desativado");

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

    // Public playbook start page - Premium design matching user's HTML
    return (
      <div className="relative flex min-h-screen w-full flex-col bg-gradient-to-b from-background via-background to-primary/5 overflow-hidden">
        {/* Header */}
        <header className="fixed top-0 left-0 w-full z-50">
          <div className="w-full h-1 bg-muted">
            <div className="h-full bg-primary transition-all duration-1000 ease-out w-[0%]"></div>
          </div>
          <div className="mx-auto max-w-7xl px-6 md:px-12 py-6 flex justify-between items-center animate-fade-in">
            <div className="flex items-center gap-6">
              <img 
                alt="Logo" 
                className="h-10 w-auto object-contain" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDOvmj4FSaOAWFkqiThV2DYNv-FhkOW4Hdyl2LCSCoshUjR2133u4scoTk1QK1eiIWpff6mhnvuQJia1Id8iLbIJI7yfO8rccOI6tCo8M2S2o6epKVBVV2qrJ2vPhgOxDUCtsUfavfyxxMW33okBh6F_BiAz9qbmOYTrvc4CJhxcMd_QW3nUlecUjnbQh2mpC17ZuxPEGVEqcbR_gI0GBPRIE6_Zem3XHDsVgSKfl4n6iz-tDJj1B4PkcQWwYZkLZ5r_iYqxkp4IOI8"
              />
              <div className="h-6 w-px bg-border"></div>
              <img 
                alt="3CLIQUES" 
                className="h-6 w-auto object-contain opacity-80" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBe_-Wt9LFoBHn6xzRaiqTTeKpfdIn-uZG6V0DnXKW5baUXpEDymzSfnqFxd9NO_zC1Re4l8rH31XwI2LsTEXX9igrJzevOStB9CpWcF0NRUs7COHpt6gEc0ZmLymFW1tihmyz_qr9_1_ukp_zON2iFyPb4rdb_jWeb1HKkVdDFzwzr9VMmPrVhB_o5d1nXntHqUGPDTQ37l2MqbrMntgLsBV1lbUjAEdjwk3E9LEl7pY9y8H2va46dVdixAvEhOK9dK2J9gJA7poc4"
              />
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">v 2.0</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-col items-center justify-center flex-grow w-full px-4 text-center pt-24">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
            <div className="space-y-6">
              <h1 className="animate-fade-in text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.05]">
                Seja Bem Vindo ao Seu<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                  {playbookInfo.name}
                </span>
              </h1>
              
              {playbookInfo.description && (
                <p className="animate-fade-in text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-normal leading-relaxed" style={{ animationDelay: '0.2s' }}>
                  {playbookInfo.description}
                </p>
              )}
            </div>
            
            <div className="h-8 md:h-12"></div>
            
            <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <Button
                onClick={handleStartPlaybook}
                disabled={isStarting}
                size="lg"
                className="group flex items-center gap-3 px-8 py-6 text-lg font-medium rounded-full shadow-lg hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02]"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Preparando...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar Meu Playbook</span>
                    <Play className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="absolute bottom-0 w-full py-8 text-center animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <span className="inline-flex items-center gap-1">
                📚 Guiado passo a passo
              </span>
              <span className="mx-1 opacity-50">•</span>
              <span className="inline-flex items-center gap-1">
                ✅ Conclusão leva a consultoria exclusiva
              </span>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-2">
              © {new Date().getFullYear()} Armazém Drop. Todos os direitos reservados.
            </p>
          </div>
        </footer>

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

  // Vai direto para o WizardView se tem steps, senão mostra mensagem de processamento
  if (data.steps.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 max-w-md text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Preparando seu onboarding...</h1>
          <p className="text-muted-foreground mb-4">
            Estamos configurando sua jornada personalizada.
          </p>
          <Button onClick={loadOnboardingData} variant="outline">
            Atualizar
          </Button>
        </div>
        <WhatsAppFloatingButton phone={supportPhone} customerName={displayName} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <WizardView
        steps={data.steps}
        customerName={displayName}
        contactId={data.contact.id}
        supportPhone={supportPhone}
        onRefresh={loadOnboardingData}
      />
      
      <WhatsAppFloatingButton
        phone={supportPhone}
        customerName={displayName}
      />
    </div>
  );
}
