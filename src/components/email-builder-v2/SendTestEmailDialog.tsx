import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Loader2, Mail, Eye, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateEmailHTML, replaceVariables, defaultSampleData } from "@/utils/emailHtmlGenerator";
import { useEmailVariables } from "@/hooks/useEmailBuilderV2";
import type { EmailBlock } from "@/types/emailBuilderV2";

interface SendTestEmailDialogProps {
  templateId: string;
  blocks: EmailBlock[];
  subject?: string;
  preheader?: string;
  trigger?: React.ReactNode;
}

export function SendTestEmailDialog({
  templateId,
  blocks,
  subject,
  preheader,
  trigger,
}: SendTestEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sampleData, setSampleData] = useState<Record<string, string>>(defaultSampleData);
  const { toast } = useToast();
  
  const { data: variables } = useEmailVariables();

  // Generate HTML with variable substitution
  const generatedHtml = useMemo(() => {
    const rawHtml = generateEmailHTML(blocks, { preheader, subject });
    return replaceVariables(rawHtml, sampleData);
  }, [blocks, preheader, subject, sampleData]);

  // Generate subject with variable substitution
  const finalSubject = useMemo(() => {
    return replaceVariables(subject || "Teste de Template", sampleData);
  }, [subject, sampleData]);

  const handleUpdateSampleData = (key: string, value: string) => {
    setSampleData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, insira um email de destino",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      // Call the send-email edge function
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject: `[TESTE] ${finalSubject}`,
          html: generatedHtml,
          isTest: true,
          templateId,
        },
      });

      if (error) throw error;

      // Log the test send
      await supabase.from("email_sends").insert({
        template_id: templateId,
        recipient_email: testEmail,
        subject: `[TESTE] ${finalSubject}`,
        status: "sent",
        variables_used: sampleData as any,
      });

      setEmailSent(true);
      toast({
        title: "Email enviado!",
        description: `Email de teste enviado para ${testEmail}`,
      });

      // Reset after 3 seconds
      setTimeout(() => {
        setEmailSent(false);
      }, 3000);
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar o email de teste",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Send className="h-4 w-4 mr-2" />
            Enviar Teste
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar Email de Teste
          </DialogTitle>
          <DialogDescription>
            Envie um email de teste para verificar a aparência do template
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="send" className="mt-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="send" className="gap-2">
              <Send className="h-4 w-4" />
              Enviar
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-4">
            <div className="space-y-6">
              {/* Email recipient */}
              <div className="space-y-2">
                <Label htmlFor="testEmail">Email de Destino</Label>
                <Input
                  id="testEmail"
                  type="email"
                  placeholder="seu@email.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O email será enviado com o prefixo [TESTE] no assunto
                </p>
              </div>

              {/* Subject preview */}
              <div className="space-y-2">
                <Label>Assunto</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">[TESTE] {finalSubject}</p>
                </div>
              </div>

              {/* Sample data */}
              <div className="space-y-3">
                <Label>Dados de Teste</Label>
                <ScrollArea className="h-48 border rounded-lg p-3">
                  <div className="space-y-3">
                    {(variables || []).slice(0, 6).map((variable) => (
                      <div key={variable.variable_key} className="flex items-center gap-2">
                        <code className="text-xs text-primary bg-primary/10 px-1 rounded min-w-[120px]">
                          {`{{${variable.variable_key}}}`}
                        </code>
                        <Input
                          value={sampleData[variable.variable_key] || ""}
                          onChange={(e) => handleUpdateSampleData(variable.variable_key, e.target.value)}
                          placeholder={variable.sample_value || ""}
                          className="h-8 text-sm flex-1"
                        />
                      </div>
                    ))}
                    
                    {(!variables || variables.length === 0) && 
                      Object.entries(defaultSampleData).slice(0, 6).map(([key, defaultValue]) => (
                        <div key={key} className="flex items-center gap-2">
                          <code className="text-xs text-primary bg-primary/10 px-1 rounded min-w-[120px]">
                            {`{{${key}}}`}
                          </code>
                          <Input
                            value={sampleData[key] || ""}
                            onChange={(e) => handleUpdateSampleData(key, e.target.value)}
                            placeholder={defaultValue}
                            className="h-8 text-sm flex-1"
                          />
                        </div>
                      ))
                    }
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="border rounded-lg bg-slate-100 h-80 overflow-hidden">
              <iframe
                srcDoc={generatedHtml}
                title="Email Preview"
                className="w-full h-full bg-white"
                style={{ border: "none" }}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSendTest} disabled={isSending || emailSent}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : emailSent ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Enviado!
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Teste
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
