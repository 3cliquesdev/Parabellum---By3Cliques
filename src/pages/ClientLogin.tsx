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
import { Loader2, Shield } from "lucide-react";
import { z } from "zod";
import { ROLE_HOME_PAGES } from "@/config/roles";

const authSchema = z.object({
  email: z.string().email({ message: "E-mail inválido" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

export default function ClientLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  // Redirect after auth
  useEffect(() => {
    if (!authLoading && !roleLoading && user && role) {
      if (user.user_metadata?.must_change_password === true) {
        navigate("/setup-password");
        return;
      }
      if (role === "user") {
        navigate("/client-portal");
      } else {
        // Non-client roles go to their default home
        const homePage = ROLE_HOME_PAGES[role as keyof typeof ROLE_HOME_PAGES] || "/";
        navigate(homePage);
      }
    }
  }, [user, role, authLoading, roleLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos"
          : signInError.message
      );
    } else {
      toast({ title: "Login realizado!", description: "Bem-vindo ao Portal." });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Informe seu e-mail para redefinir a senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/setup-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
      setError(null);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(221,83%,53%)] via-[hsl(250,70%,50%)] to-[hsl(280,60%,45%)] p-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-[hsl(221,83%,96%)] text-[hsl(221,83%,40%)] text-xs font-semibold px-3 py-1.5 rounded-full">
              <Shield className="w-3.5 h-3.5" />
              Portal do Cliente
            </div>
            <h1 className="text-2xl font-bold text-[hsl(222,47%,11%)]">
              Bem-vindo ao Portal
            </h1>
            <p className="text-sm text-[hsl(215,16%,47%)]">
              Acesse seu painel de acompanhamento
            </p>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Reset sent success */}
          {resetSent && (
            <Alert className="border-[hsl(142,76%,36%)] bg-[hsl(142,76%,93%)]">
              <AlertDescription className="text-[hsl(142,76%,25%)]">
                📧 E-mail de redefinição enviado para <strong>{email}</strong>!
                <br />
                <span className="text-xs mt-1 block">
                  Verifique sua caixa de entrada e spam. O link expira em 24 horas.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Form */}
          {!showForgotPassword ? (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[hsl(222,47%,11%)] font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 rounded-xl text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[hsl(222,47%,11%)] font-medium">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 rounded-xl text-base"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  "Entrar no Portal"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError(null);
                  setResetSent(false);
                }}
                className="w-full text-sm text-[hsl(221,83%,53%)] hover:underline"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-[hsl(222,47%,11%)] font-medium">
                  Email cadastrado
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 rounded-xl text-base"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl"
                disabled={loading || resetSent}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de redefinição"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setError(null);
                  setResetSent(false);
                }}
                className="w-full text-sm text-[hsl(215,16%,47%)] hover:underline"
              >
                ← Voltar ao login
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-[hsl(215,16%,57%)] pt-2 border-t border-[hsl(215,16%,88%)]">
            <p>PARABELLUM · Portal do Cliente</p>
          </div>
        </div>
      </div>
    </main>
  );
}
