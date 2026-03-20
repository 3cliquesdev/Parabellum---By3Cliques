import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, Mail, Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import logoLightFallback from "@/assets/logo-parabellum-light.png";
import { useCRMBranding } from "@/hooks/useCRMBranding";
import { User, Session } from "@supabase/supabase-js";

type Step = "send_code" | "verify_otp" | "set_password";

export default function SetupPassword() {
  const { data: crmBranding } = useCRMBranding();
  const setupLogo = crmBranding?.logo_url || logoLightFallback;
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState<Step>("send_code");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Verificar sessão diretamente no componente para evitar race conditions
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setAuthLoading(false);
      } catch (err) {
        console.error("SetupPassword: Error checking session", err);
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    checkSession();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirecionar para login se não autenticado
  if (!user || !user.email) {
    return <Navigate to="/auth" replace />;
  }

const userEmail = user.email;
  const userName = user.user_metadata?.full_name || "Usuário";

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: "local" });
      setUser(null);
      setSession(null);
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/auth");
    }
  };

  const handleSendCode = async () => {
    if (!userEmail) {
      setError("Email do usuário não encontrado");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await supabase.functions.invoke('send-verification-code', {
        body: { email: userEmail, type: 'employee' }
      });

      if (response.error) {
        // Handle rate limit error (429)
        if (response.error.message?.includes("Edge Function returned a non-2xx status code")) {
          throw new Error("Limite de códigos atingido. Aguarde 1 hora antes de tentar novamente.");
        }
        throw response.error;
      }
      
      if (!response.data?.success && response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Código enviado para seu email!");
      setStep("verify_otp");
    } catch (err: any) {
      console.error("Erro ao enviar código:", err);
      const errorMessage = err.message || "Erro ao enviar código de verificação";
      setError(errorMessage);
      
      if (errorMessage.includes("Limite de códigos atingido")) {
        toast.error("⏱️ Limite atingido! Aguarde 1 hora.", { duration: 5000 });
      } else {
        toast.error("Falha ao enviar código");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError("Digite o código de 6 dígitos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { email: userEmail, code: otp }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Código inválido");

      toast.success("Email validado com sucesso!");
      setStep("set_password");
    } catch (err: any) {
      console.error("Erro ao validar código:", err);
      setError(err.message || "Código inválido ou expirado");
      toast.error("Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    setError("");

    // Validações
    if (newPassword.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não conferem");
      return;
    }

    setLoading(true);

    try {
      // 1. Atualizar senha
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) throw passwordError;

      // 2. Remover flag must_change_password
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          must_change_password: false,
        },
      });

      if (metadataError) throw metadataError;

      toast.success("Conta ativada com segurança!");
      
      // Pequeno delay para garantir que a atualização foi processada
      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (err: any) {
      console.error("Erro ao definir senha:", err);
      setError(err.message || "Erro ao definir nova senha");
      toast.error("Falha ao definir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <img 
            src={setupLogo} 
            alt={crmBranding?.name || "Logo"} 
            className="h-16 w-auto mx-auto mb-4 object-contain" 
          />
          <CardTitle className="text-2xl">Primeiro Acesso - Validação de Segurança</CardTitle>
          <CardDescription>
            {step === "send_code" && "Este é seu primeiro acesso. Para ativar sua conta, precisamos validar seu e-mail."}
            {step === "verify_otp" && "Digite o código enviado para seu email"}
            {step === "set_password" && "Defina sua senha definitiva"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ETAPA 1: Enviar Código */}
          {step === "send_code" && (
            <div className="space-y-4">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  Olá <strong>{userName}</strong>. Este é seu primeiro acesso. Por segurança, precisamos validar seu email antes de ativar sua conta.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={userEmail} disabled className="bg-muted" />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Código de Verificação
                  </>
                )}
              </Button>
            </div>
          )}

          {/* ETAPA 2: Validar OTP */}
          {step === "verify_otp" && (
            <div className="space-y-4">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  Enviamos um código de 6 dígitos para <strong>{userEmail}</strong>. Verifique sua caixa de entrada e spam.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label className="text-center block">Código de Verificação</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={setOtp}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    "Validar Código"
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setStep("send_code")}
                  disabled={loading}
                  className="w-full"
                >
                  Reenviar Código
                </Button>
              </div>
            </div>
          )}

          {/* ETAPA 3: Definir Senha */}
          {step === "set_password" && (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-900 dark:text-green-100">
                  Email validado! Agora defina sua senha definitiva.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Digite a senha novamente"
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSetPassword}
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Definindo...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Definir Senha e Continuar
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Botão de Logout - sempre visível */}
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full text-muted-foreground hover:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair e voltar ao login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
