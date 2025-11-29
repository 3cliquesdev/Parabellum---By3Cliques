import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import logoLight from "@/assets/logo-parabellum-light.png";

type Step = "send_code" | "verify_otp" | "set_password";

export default function SetupPassword() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("send_code");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const userEmail = user?.email || "";
  const userName = user?.user_metadata?.full_name || "Usuário";

  const handleSendCode = async () => {
    if (!userEmail) {
      setError("Email do usuário não encontrado");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) throw otpError;

      toast.success("Código enviado para seu email!");
      setStep("verify_otp");
    } catch (err: any) {
      console.error("Erro ao enviar código:", err);
      setError(err.message || "Erro ao enviar código de verificação");
      toast.error("Falha ao enviar código");
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
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otp,
        type: "email",
      });

      if (verifyError) throw verifyError;

      toast.success("Email validado com sucesso!");
      setStep("set_password");
    } catch (err: any) {
      console.error("Erro ao validar código:", err);
      setError("Código inválido ou expirado");
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

      toast.success("Senha definida com sucesso!");
      
      // Pequeno delay para garantir que a atualização foi processada
      setTimeout(() => {
        navigate("/dashboard");
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
            src={logoLight} 
            alt="Seu Armazém Drop" 
            className="h-16 w-auto mx-auto mb-4 object-contain" 
          />
          <CardTitle className="text-2xl">Configuração de Segurança</CardTitle>
          <CardDescription>
            {step === "send_code" && "Valide seu email para definir uma senha segura"}
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
                  Olá <strong>{userName}</strong>. Por segurança, precisamos validar seu email antes de definir sua senha definitiva.
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
        </CardContent>
      </Card>
    </div>
  );
}
