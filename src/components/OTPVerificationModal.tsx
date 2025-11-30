import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Mail, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OTPVerificationModalProps {
  open: boolean;
  email: string;
  onVerified: (contactId: string) => void;
  onCancel: () => void;
}

export function OTPVerificationModal({ open, email, onVerified, onCancel }: OTPVerificationModalProps) {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Código deve ter 6 dígitos");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const { data, error: verifyError } = await supabase.functions.invoke('verify-code', {
        body: { email, code }
      });

      if (verifyError) throw verifyError;

      if (data.success && data.contact_id) {
        toast({ title: "✅ Identidade verificada!" });
        onVerified(data.contact_id);
      } else {
        setError(data.error || "Código inválido. Tente novamente.");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao verificar código");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError("");

    try {
      const { error: resendError } = await supabase.functions.invoke('send-verification-code', {
        body: { email }
      });

      if (resendError) throw resendError;

      toast({ title: "📧 Novo código enviado para seu email" });
      setCode("");
    } catch (err: any) {
      setError(err.message || "Erro ao reenviar código");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Verificação de Identidade</DialogTitle>
          <DialogDescription className="text-center">
            Este e-mail já tem histórico conosco. Para acessar suas conversas anteriores, precisamos verificar sua identidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Enviamos um código de 6 dígitos para <strong>{email}</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Código de Verificação</Label>
            <Input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending ? "Reenviando..." : "Reenviar Código"}
            </Button>
            <Button 
              className="flex-1"
              onClick={handleVerify}
              disabled={isVerifying || code.length !== 6}
            >
              {isVerifying ? "Verificando..." : "Verificar"}
            </Button>
          </div>

          <Button 
            variant="ghost" 
            className="w-full"
            onClick={onCancel}
          >
            Continuar sem histórico
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
