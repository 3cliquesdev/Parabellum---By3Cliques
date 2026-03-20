import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Target } from "lucide-react";
import { z } from "zod";
import { useCRMBranding } from "@/hooks/useCRMBranding";

const logoFallback = "/logo-parabellum-light.png";
const authSchema = z.object({
  email: z.string().email({
    message: "E-mail inválido"
  }),
  password: z.string().min(6, {
    message: "Senha deve ter no mínimo 6 caracteres"
  })
});
export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user,
    loading: authLoading
  } = useAuth();
  const {
    role,
    loading: roleLoading
  } = useUserRole();
  const { data: crmBranding } = useCRMBranding();
  const brandName = crmBranding?.name || "CRM";
  const brandLogo = crmBranding?.logo_url || logoFallback;

  // Redirect based on role after authentication
  useEffect(() => {
    if (!authLoading && !roleLoading && user && role) {
      // PRIORITY 1: Force password change if required
      if (user.user_metadata?.must_change_password === true) {
        navigate("/setup-password");
        return;
      }

      // PRIORITY 2: Role-based intelligent routing
      switch (role) {
        case "support_agent":
          navigate("/support");
          break;
        case "consultant":
          navigate("/my-portfolio");
          break;
        case "sales_rep":
          navigate("/");
          break;
        case "admin":
          navigate("/analytics");
          break;
        case "manager":
          navigate("/analytics");
          break;
        case "cs_manager":
          navigate("/analytics");
          break;
        case "support_manager":
          navigate("/analytics");
          break;
        case "financial_manager":
          navigate("/analytics");
          break;
        case "general_manager":
          navigate("/analytics");
          break;
        case "ecommerce_analyst":
          navigate("/analytics");
          break;
        case "user":
          navigate("/client-portal");
          break;
        default:
          navigate("/client-portal");
      }
    }
  }, [user, role, authLoading, roleLoading, navigate]);
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validation = authSchema.safeParse({
      email,
      password
    });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    setLoading(true);
    const {
      error: signInError
    } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : signInError.message);
    } else {
      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta."
      });
      // Redirection will be handled by useEffect based on role
    }
  };
  return <main className="min-h-screen flex">
      {/* Left Column - Brand (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-primary/20 p-12 flex-col justify-between overflow-hidden px-[4px]">
        {/* Decorative grid pattern */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center flex-1">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <Target className="h-10 w-10 text-primary" />
              <span className="text-3xl font-bold text-primary tracking-tight">{brandName.toUpperCase()}</span>
            </div>
            <div className="h-1 w-24 bg-primary/60 rounded-full" />
          </div>

          {/* Epic Quote */}
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white leading-tight md:text-4xl font-sans">
              Para os concorrentes, uma equipe grande é um custo, e eles cortam. Para nós, o TIME é uma força, e temos um mercado para dominar.
            </h1>
            
            <p className="text-xl italic text-slate-300 font-light">
              "Se queres paz, prepara-te para a guerra"
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-sm text-slate-400">
            © 2025 PARABELLUM CRM. Sistema Enterprise.
          </p>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <img src={logoLight} alt="PARABELLUM" width={308} height={168} className="h-24 w-auto mx-auto mb-4" loading="eager" fetchPriority="high" decoding="async" />
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-foreground mb-2">Bem-vindo ao Q.G</h2>
            <p className="text-muted-foreground">Insira suas credenciais </p>
          </div>

          {/* Error Alert */}
          {error && <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>}

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                Email
              </Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} className="h-12 rounded-xl text-base transition-all" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                Senha
              </Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} className="h-12 rounded-xl text-base transition-all" />
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all" disabled={loading}>
              {loading ? <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Entrando...
                </> : "Entrar no Sistema"}
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground pt-4 border-t border-border">
            <p>Acesso restrito a convidados</p>
          </div>
        </div>
      </div>
    </main>;
}