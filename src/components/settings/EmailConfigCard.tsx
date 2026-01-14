import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2, Send, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function EmailConfigCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState("");

  const { data: configs, isLoading } = useQuery({
    queryKey: ["email-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_configurations")
        .select("*")
        .eq("category", "email")
        .order("key");
      
      if (error) throw error;
      return data || [];
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("system_configurations")
        .update({ value })
        .eq("key", key);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-configs"] });
      toast({
        title: "Configuração atualizada",
        description: "As alterações foram salvas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("test-email-send", {
        body: { to: email, type: "customer" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "✅ Email enviado!",
        description: "Verifique a caixa de entrada do email de teste",
      });
      setTestEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const customerSender = configs?.find(c => c.key === "email_sender_customer")?.value || "";
  const employeeSender = configs?.find(c => c.key === "email_sender_employee")?.value || "";
  const verifiedDomain = configs?.find(c => c.key === "email_verified_domain")?.value || "";

  // Check if sender domains match the primary verified domain
  const getSenderDomain = (sender: string) => {
    const match = sender.match(/<[^@]+@([^>]+)>/);
    return match ? match[1] : null;
  };

  const customerDomain = getSenderDomain(customerSender);
  const employeeDomain = getSenderDomain(employeeSender);
  
  const hasDomainMismatch = verifiedDomain && (
    (customerDomain && !customerDomain.includes(verifiedDomain)) ||
    (employeeDomain && !employeeDomain.includes(verifiedDomain))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Remetentes de Email
        </CardTitle>
        <CardDescription>
          Configure os remetentes e teste envio de emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {verifiedDomain && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Domínio principal: {verifiedDomain}
                  </span>
                </div>
              )}

              {hasDomainMismatch && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    <strong>Atenção:</strong> Os remetentes usam domínio diferente do principal ({verifiedDomain}). 
                    Considere atualizar os emails para usar o mesmo domínio verificado.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="customer-sender">Remetente para Clientes</Label>
                <div className="flex gap-2">
                  <Input
                    id="customer-sender"
                    value={customerSender}
                    onChange={(e) => {
                      const config = configs?.find(c => c.key === "email_sender_customer");
                      if (config) {
                        updateConfigMutation.mutate({
                          key: "email_sender_customer",
                          value: e.target.value,
                        });
                      }
                    }}
                    placeholder="Nome <email@dominio.com>"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usado em: OTP, tickets, notificações de clientes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee-sender">Remetente para Funcionários</Label>
                <div className="flex gap-2">
                  <Input
                    id="employee-sender"
                    value={employeeSender}
                    onChange={(e) => {
                      const config = configs?.find(c => c.key === "email_sender_employee");
                      if (config) {
                        updateConfigMutation.mutate({
                          key: "email_sender_employee",
                          value: e.target.value,
                        });
                      }
                    }}
                    placeholder="Nome <email@dominio.com>"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usado em: criação de usuários, reset de senha
                </p>
              </div>
            </div>

            <div className="pt-4 border-t space-y-4">
              <div>
                <Label className="text-base font-semibold">📬 Testar Envio de Email</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Envie um email de teste para verificar a configuração
                </p>
              </div>
              
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button
                  onClick={() => testEmail && testEmailMutation.mutate(testEmail)}
                  disabled={!testEmail || testEmailMutation.isPending}
                >
                  {testEmailMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
