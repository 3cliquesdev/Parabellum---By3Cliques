import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MessageSquare, Loader2, ShieldCheck, UserPlus, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type FormState = 'email_input' | 'checking' | 'otp_existing' | 'new_lead_form' | 'submitting';

const emailSchema = z.object({
  email: z.string().email("Email inválido"),
});

const newLeadSchema = z.object({
  email: z.string().email("Email inválido"),
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().optional(),
  otp: z.string().length(6, "Código deve ter 6 dígitos"),
});

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  assigned_to: string | null;
  consultant_id: string | null;
  status: string;
}

interface PreChatFormProps {
  onExistingCustomerVerified: (contact: Contact, departmentId: string, sessionVerified?: boolean) => void;
  onNewLeadCreated: (data: { email: string; first_name: string; last_name: string; phone?: string }, departmentId: string) => void;
  isLoading?: boolean;
}

export function PreChatForm({ onExistingCustomerVerified, onNewLeadCreated, isLoading }: PreChatFormProps) {
  const { toast } = useToast();
  const [formState, setFormState] = useState<FormState>('email_input');
  const [email, setEmail] = useState("");
  const [existingContact, setExistingContact] = useState<Contact | null>(null);
  const [recommendedDeptId, setRecommendedDeptId] = useState<string>("");
  const [otp, setOtp] = useState("");

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const newLeadForm = useForm<z.infer<typeof newLeadSchema>>({
    resolver: zodResolver(newLeadSchema),
    defaultValues: { email: "", full_name: "", phone: "", otp: "" },
  });

  const handleCheckEmail = async (values: z.infer<typeof emailSchema>) => {
    try {
      setFormState('checking');
      setEmail(values.email);

      // Chamar Edge Function para verificar status do usuário
      const { data, error } = await supabase.functions.invoke('check-user-status', {
        body: { email: values.email }
      });

      if (error) throw error;

      if (data.exists) {
        // Cliente existente - ir para OTP
        setExistingContact(data.contact);
        setRecommendedDeptId(data.recommended_department_id);

        // Enviar código OTP
        const { data: otpData, error: sendError } = await supabase.functions.invoke('send-verification-code', {
          body: { email: values.email }
        });

        if (sendError) throw sendError;

        setFormState('otp_existing');
        
        // Detectar modo desenvolvimento
        if (otpData?.dev_mode && otpData?.code) {
          toast({
            title: "🔧 Modo Desenvolvimento",
            description: `Código OTP para testes: ${otpData.code}`,
            duration: 10000, // 10 segundos
          });
          setOtp(otpData.code); // Pre-preencher o campo
        } else {
          toast({
            title: "Código enviado! 📧",
            description: `Enviamos um código de verificação para ${values.email}`,
          });
        }
      } else {
        // Lead novo - ir para formulário completo
        setRecommendedDeptId(data.recommended_department_id);
        newLeadForm.setValue('email', values.email);

        // Enviar código OTP para validar email
        const { data: otpData, error: sendError } = await supabase.functions.invoke('send-verification-code', {
          body: { email: values.email }
        });

        if (sendError) throw sendError;

        setFormState('new_lead_form');
        
        // Detectar modo desenvolvimento
        if (otpData?.dev_mode && otpData?.code) {
          toast({
            title: "🔧 Modo Desenvolvimento",
            description: `Código OTP para testes: ${otpData.code}`,
            duration: 10000, // 10 segundos
          });
          newLeadForm.setValue('otp', otpData.code); // Pre-preencher o campo
        } else {
          toast({
            title: "Código enviado! 📧",
            description: `Enviamos um código para validar seu e-mail`,
          });
        }
      }

    } catch (error: any) {
      console.error('[PreChatForm] Erro ao verificar email:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao verificar e-mail",
        variant: "destructive",
      });
      setFormState('email_input');
    }
  };

  const handleVerifyExistingCustomer = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Código inválido",
        description: "Digite o código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    try {
      setFormState('submitting');

      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { email, code: otp }
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Código inválido",
          description: data.error || "Verifique o código e tente novamente",
          variant: "destructive",
        });
        setFormState('otp_existing');
        return;
      }

      // OTP válido - cliente verificado
      toast({
        title: "Bem-vindo de volta! ✨",
        description: `Olá, ${existingContact?.first_name}! Seu histórico está disponível.`,
      });

      onExistingCustomerVerified(existingContact!, recommendedDeptId, true);

    } catch (error: any) {
      console.error('[PreChatForm] Erro ao verificar OTP:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao verificar código",
        variant: "destructive",
      });
      setFormState('otp_existing');
    }
  };

  const handleContinueWithoutHistory = () => {
    // Cliente decide não verificar - vincular ao cliente existente mas sem verificação
    toast({
      title: "Conectando...",
      description: "Iniciando conversa sem verificação de histórico",
    });
    
    onExistingCustomerVerified(existingContact!, recommendedDeptId, false);
  };

  const handleCreateNewLead = async (values: z.infer<typeof newLeadSchema>) => {
    try {
      setFormState('submitting');

      // Verificar código OTP
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { email: values.email, code: values.otp }
      });

      if (error) throw error;

      if (!data.success) {
        toast({
          title: "Código inválido",
          description: data.error || "Verifique o código e tente novamente",
          variant: "destructive",
        });
        setFormState('new_lead_form');
        return;
      }

      // Separar nome completo em first_name e last_name
      const nameParts = values.full_name.trim().split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ') || first_name;

      toast({
        title: "Seja bem-vindo! 🎉",
        description: "Nossa equipe comercial vai adorar conhecê-lo.",
      });

      onNewLeadCreated(
        {
          email: values.email,
          first_name,
          last_name,
          phone: values.phone,
        },
        recommendedDeptId
      );

    } catch (error: any) {
      console.error('[PreChatForm] Erro ao criar lead:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar cadastro",
        variant: "destructive",
      });
      setFormState('new_lead_form');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 to-secondary/10">
      <AnimatePresence mode="wait">
        {/* ESTADO 1: Email Input */}
        {formState === 'email_input' && (
          <motion.div
            key="email_input"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full max-w-md shadow-xl">
              <CardHeader className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Como podemos te ajudar?</CardTitle>
                <CardDescription>Digite seu e-mail para começarmos</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(handleCheckEmail)} className="space-y-4">
                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="seu@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {isLoading ? "Verificando..." : "Continuar"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ESTADO 2: Cliente Existente - OTP */}
        {formState === 'otp_existing' && existingContact && (
          <motion.div
            key="otp_existing"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full max-w-md shadow-xl">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={existingContact.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {existingContact.first_name[0]}{existingContact.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      Olá de novo, {existingContact.first_name}! ✨
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Verifique sua identidade para acessar seu histórico
                    </CardDescription>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-green-600" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    Enviamos um código de 6 dígitos para <strong>{email}</strong>
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Código de Verificação</label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
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

                <Button 
                  onClick={handleVerifyExistingCustomer} 
                  className="w-full" 
                  size="lg"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Verificar
                </Button>

                <Button 
                  onClick={handleContinueWithoutHistory} 
                  variant="ghost" 
                  className="w-full"
                  disabled={isLoading}
                >
                  Continuar sem histórico
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ESTADO 3: Lead Novo - Formulário Completo */}
        {formState === 'new_lead_form' && (
          <motion.div
            key="new_lead_form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="w-full max-w-md shadow-xl">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-primary" />
                  <CardTitle className="text-xl">Prazer em conhecê-lo! 🎉</CardTitle>
                </div>
                <CardDescription>
                  Complete seu cadastro para iniciarmos o atendimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...newLeadForm}>
                  <form onSubmit={newLeadForm.handleSubmit(handleCreateNewLead)} className="space-y-4">
                    <FormField
                      control={newLeadForm.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo *</FormLabel>
                          <FormControl>
                            <Input placeholder="João Silva" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={newLeadForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp (opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator className="my-4" />

                    <Alert>
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        Enviamos um código para <strong>{email}</strong>
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={newLeadForm.control}
                      name="otp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código de Verificação</FormLabel>
                          <FormControl>
                            <div className="flex justify-center">
                              <InputOTP maxLength={6} {...field}>
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
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Iniciar Conversa
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
