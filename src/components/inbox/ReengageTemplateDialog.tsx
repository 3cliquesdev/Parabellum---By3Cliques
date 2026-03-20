import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, FileText, AlertTriangle, Loader2 } from "lucide-react";

interface ReengageTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationStatus?: string;
  conversation: {
    id: string;
    contact_id: string | null;
    channel: string;
    status?: string;
    whatsapp_instance_id: string | null;
    whatsapp_meta_instance_id?: string | null;
    contacts: {
      phone: string | null;
      first_name: string;
      last_name: string;
    };
  };
}

export function ReengageTemplateDialog({
  open,
  onOpenChange,
  conversation,
}: ReengageTemplateDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<number, string>>({});

  const instanceId = conversation.whatsapp_meta_instance_id || conversation.whatsapp_instance_id;

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["whatsapp-templates-active", instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data, error } = await supabase
        .from("whatsapp_message_templates" as any)
        .select("*")
        .eq("instance_id", instanceId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!instanceId,
  });

  const selectedTemplate = templates.find((t: any) => t.id === selectedTemplateId);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate || !conversation.contacts.phone) throw new Error("Dados insuficientes");

      // Build template components with variables
      const components: any[] = [];
      if (selectedTemplate.has_variables && Object.keys(variables).length > 0) {
        const parameters = Object.entries(variables)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, value]) => ({ type: "text", text: value }));
        
        if (parameters.length > 0) {
          components.push({ type: "body", parameters });
        }
      }

      // 1. Send template via send-meta-whatsapp
      const { data, error } = await supabase.functions.invoke("send-meta-whatsapp", {
        body: {
          phone_number: conversation.contacts.phone,
          instance_id: instanceId,
          conversation_id: conversation.id,
          sender_id: user?.id,
          template: {
            name: selectedTemplate.name,
            language_code: selectedTemplate.language_code,
            components: components.length > 0 ? components : undefined,
            body_text: selectedTemplate.body_text || selectedTemplate.description || null,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // 1.5 Close any other open conversation for same contact to avoid unique constraint
      if (conversation.contact_id) {
        await supabase
          .from("conversations")
          .update({ status: "closed", closed_at: new Date().toISOString(), closed_reason: "reopened_elsewhere" })
          .eq("contact_id", conversation.contact_id)
          .eq("status", "open")
          .neq("id", conversation.id);
      }

      // 2. Reopen conversation
      const { error: updateError } = await supabase
        .from("conversations")
        .update({
          status: "open",
          ai_mode: "waiting_human",
          assigned_to: user?.id,
          closed_at: null,
          closed_by: null,
          closed_reason: null,
        })
        .eq("id", conversation.id);

      if (updateError) throw updateError;

      // 3. Message is now saved by the edge function with provider_message_id (wamid)
      // No manual insert needed - delivery tracking (sent/delivered/read) will work automatically
    },
    onSuccess: async () => {
      // Registrar na timeline do contato
      if (conversation.contact_id) {
        supabase.from("interactions").insert({
          customer_id: conversation.contact_id,
          type: "whatsapp_msg",
          channel: "whatsapp",
          direction: "outbound",
          content: `📋 Template enviado: ${selectedTemplate?.name}`,
          metadata: {
            template_name: selectedTemplate?.name,
            template_category: selectedTemplate?.category,
            conversation_id: conversation.id,
            sent_by: user?.id,
          },
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["unified-timeline", conversation.contact_id] });
          queryClient.invalidateQueries({ queryKey: ["customer-timeline", conversation.contact_id] });
        });
      }

      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-items"] });
      queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
      
      // Fechar dialog e limpar estado
      onOpenChange(false);
      setSelectedTemplateId(null);
      setVariables({});
      
      toast({ title: "Template enviado!", description: "Conversa reaberta e atribuída a você." });
      
      // Navegar para a conversa na aba "Minhas" instantaneamente
      navigate(`/inbox?filter=mine&conversation=${conversation.id}`);
    },
    onError: (err: any) => {
      const msg = err.message || "Erro desconhecido";
      // Meta error 131047 = template not approved
      const isTemplateError = msg.includes("131047");
      toast({
        title: isTemplateError ? "Template não aprovado" : "Erro ao enviar template",
        description: isTemplateError
          ? "Este template ainda não foi aprovado pelo Meta. Verifique no Meta Business Manager."
          : msg,
        variant: "destructive",
      });
    },
  });

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setVariables({});
    const t = templates.find((x: any) => x.id === id);
    if (t?.has_variables && t.variable_examples) {
      const initial: Record<number, string> = {};
      t.variable_examples.forEach((v: any) => {
        initial[v.index] = "";
      });
      setVariables(initial);
    }
  };

  const canSend = selectedTemplate && !sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Reengajar via Template
          </DialogTitle>
          <DialogDescription>
            Envie um template aprovado pelo Meta para reabrir a conversa com{" "}
            {conversation.contacts.first_name}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando templates...</p>
        ) : templates.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 mx-auto text-warning" />
            <p className="text-sm text-muted-foreground">
              Nenhum template ativo cadastrado para esta instância.
            </p>
            <p className="text-xs text-muted-foreground">
              Cadastre templates em Configurações → WhatsApp Meta API
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {templates.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedTemplateId === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{t.name}</span>
                      <Badge
                        variant={t.category === "MARKETING" ? "warning" : "secondary"}
                        className="text-[10px] ml-auto"
                      >
                        {t.category}
                      </Badge>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground pl-6">{t.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Variables form */}
            {selectedTemplate?.has_variables && selectedTemplate.variable_examples?.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-medium">Preencha as variáveis</Label>
                {selectedTemplate.variable_examples.map((v: any) => (
                  <div key={v.index} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">{`{{${v.index}}}`}</span>
                    <Input
                      className="h-8 text-sm"
                      placeholder={v.example || `Variável ${v.index}`}
                      value={variables[v.index] || ""}
                      onChange={e =>
                        setVariables(prev => ({ ...prev, [v.index]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
          >
            {sendMutation.isPending ? "Enviando..." : "Enviar Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
