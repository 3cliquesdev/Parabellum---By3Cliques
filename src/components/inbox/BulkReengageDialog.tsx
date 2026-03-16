import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, FileText, AlertTriangle, Users, Bot, ArrowRightLeft } from "lucide-react";

interface BulkReengageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationIds: string[];
  onSuccess: () => void;
}

type DestinationType = "auto_distribute" | "specific_agent" | "department";

export function BulkReengageDialog({
  open,
  onOpenChange,
  conversationIds,
  onSuccess,
}: BulkReengageDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<number, string>>({});
  const [destinationType, setDestinationType] = useState<DestinationType>("auto_distribute");
  const [targetAgentId, setTargetAgentId] = useState<string>("");
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>("");
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);

  // Fetch conversations to get instance IDs
  const { data: conversations = [] } = useQuery({
    queryKey: ["bulk-reengage-conversations", conversationIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id, contact_id, whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider, department,
          contacts(phone, first_name, last_name)
        `)
        .in("id", conversationIds);
      if (error) throw error;
      return data || [];
    },
    enabled: open && conversationIds.length > 0,
  });

  // Get unique instance IDs
  const instanceId = useMemo(() => {
    for (const c of conversations) {
      const id = (c as any).whatsapp_meta_instance_id || (c as any).whatsapp_instance_id;
      if (id) return id;
    }
    return null;
  }, [conversations]);

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["whatsapp-templates-active", instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      const { data, error } = await (supabase as any)
        .from("whatsapp_message_templates")
        .select("*")
        .eq("instance_id", instanceId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: open && !!instanceId,
  });

  // Fetch agents
  const { data: agents = [] } = useQuery({
    queryKey: ["profiles-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && destinationType === "specific_agent",
  });

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && destinationType === "department",
  });

  const selectedTemplate = templates.find((t: any) => t.id === selectedTemplateId);

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

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("Nenhum template selecionado");

      const total = conversations.length;
      let sent = 0;
      let failed = 0;
      setProgress({ sent: 0, failed: 0, total });

      // Build template components
      const components: any[] = [];
      if (selectedTemplate.has_variables && Object.keys(variables).length > 0) {
        const parameters = Object.entries(variables)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, value]) => ({ type: "text", text: value }));
        if (parameters.length > 0) {
          components.push({ type: "body", parameters });
        }
      }

      for (const conv of conversations) {
        const contact = (conv as any).contacts;
        const phone = contact?.phone;
        const convInstanceId = (conv as any).whatsapp_meta_instance_id || (conv as any).whatsapp_instance_id;

        if (!phone || !convInstanceId) {
          failed++;
          setProgress({ sent, failed, total });
          continue;
        }

        try {
          // Build per-conversation variables (replace {{1}} with contact name if empty)
          const perConvComponents = [...components];
          if (selectedTemplate.has_variables && perConvComponents.length > 0) {
            const bodyComp = perConvComponents.find((c: any) => c.type === "body");
            if (bodyComp?.parameters) {
              bodyComp.parameters = bodyComp.parameters.map((p: any, i: number) => ({
                ...p,
                text: p.text || (i === 0 ? contact.first_name : p.text),
              }));
            }
          }

          // 1. Send template
          const { data, error } = await supabase.functions.invoke("send-meta-whatsapp", {
            body: {
              phone_number: phone,
              instance_id: convInstanceId,
              conversation_id: conv.id,
              sender_id: user?.id,
              template: {
                name: selectedTemplate.name,
                language_code: selectedTemplate.language_code,
                components: perConvComponents.length > 0 ? perConvComponents : undefined,
              },
            },
          });

          if (error || data?.error) throw new Error(data?.error || error?.message);

          // 2. Close any other open conversation for same contact
          if (conv.contact_id) {
            await supabase
              .from("conversations")
              .update({ status: "closed", closed_at: new Date().toISOString(), closed_reason: "reopened_elsewhere" })
              .eq("contact_id", conv.contact_id)
              .eq("status", "open")
              .neq("id", conv.id);
          }

          // 3. Reopen conversation
          const updateData: any = {
            status: "open",
            ai_mode: "waiting_human",
            closed_at: null,
            closed_by: null,
            closed_reason: null,
          };

          if (destinationType === "specific_agent" && targetAgentId) {
            updateData.assigned_to = targetAgentId;
          } else if (destinationType === "department" && targetDepartmentId) {
            updateData.department = targetDepartmentId;
            updateData.assigned_to = null;
          } else {
            // auto_distribute: keep department, clear agent for dispatch job
            updateData.assigned_to = null;
          }

          await supabase.from("conversations").update(updateData).eq("id", conv.id);

          sent++;
        } catch (err) {
          console.error(`[BulkReengage] Erro conv ${conv.id}:`, err);
          failed++;
        }

        setProgress({ sent, failed, total });

        // Throttle: ~50ms between sends to avoid Meta rate limit
        await new Promise(r => setTimeout(r, 50));
      }

      return { sent, failed, total };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-view"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-counts"] });

      toast({
        title: "✅ Reengajamento concluído",
        description: `${result.sent} enviados, ${result.failed} com erro de ${result.total} total.`,
      });

      setTimeout(() => {
        setProgress(null);
        setSelectedTemplateId(null);
        setVariables({});
        onOpenChange(false);
        onSuccess();
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no reengajamento",
        description: error.message,
        variant: "destructive",
      });
      setProgress(null);
    },
  });

  const canSend =
    selectedTemplate &&
    !sendMutation.isPending &&
    (destinationType === "auto_distribute" ||
      (destinationType === "specific_agent" && targetAgentId) ||
      (destinationType === "department" && targetDepartmentId));

  const isProcessing = sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Reengajar e Distribuir
          </DialogTitle>
          <DialogDescription>
            Envie um template HSM aprovado para reabrir {conversationIds.length} conversa
            {conversationIds.length > 1 ? "s" : ""} e redistribuí-la{conversationIds.length > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        {/* Progress overlay */}
        {progress && (
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Enviando templates...</span>
              <span className="font-medium">
                {progress.sent + progress.failed}/{progress.total}
              </span>
            </div>
            <Progress value={((progress.sent + progress.failed) / progress.total) * 100} className="h-2" />
            <div className="flex gap-4 text-xs">
              <span className="text-success">✅ {progress.sent} enviados</span>
              {progress.failed > 0 && <span className="text-destructive">❌ {progress.failed} erros</span>}
            </div>
          </div>
        )}

        {!progress && (
          <>
            {/* Template Selection */}
            {templatesLoading ? (
              <p className="text-sm text-muted-foreground py-4">Carregando templates...</p>
            ) : templates.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <AlertTriangle className="h-8 w-8 mx-auto text-warning" />
                <p className="text-sm text-muted-foreground">
                  Nenhum template ativo encontrado.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Template list */}
                <div>
                  <Label className="text-xs font-medium mb-2 block">Template HSM</Label>
                  <ScrollArea className="max-h-[160px]">
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
                </div>

                {/* Variables */}
                {selectedTemplate?.has_variables && selectedTemplate.variable_examples?.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <Label className="text-xs font-medium">Variáveis do template</Label>
                    <p className="text-xs text-muted-foreground">
                      Deixe vazio para usar o nome do cliente automaticamente.
                    </p>
                    {selectedTemplate.variable_examples.map((v: any) => (
                      <div key={v.index} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10 shrink-0">{`{{${v.index}}}`}</span>
                        <Input
                          className="h-8 text-sm"
                          placeholder={v.example || `Variável ${v.index}`}
                          value={variables[v.index] || ""}
                          onChange={(e) =>
                            setVariables((prev) => ({ ...prev, [v.index]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Destination */}
                <div className="space-y-3 border-t border-border pt-3">
                  <Label className="text-xs font-medium">Destino após reengajamento</Label>
                  <Select
                    value={destinationType}
                    onValueChange={(v) => setDestinationType(v as DestinationType)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_distribute">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Auto-distribuir (Round Robin)
                        </div>
                      </SelectItem>
                      <SelectItem value="specific_agent">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          Agente específico
                        </div>
                      </SelectItem>
                      <SelectItem value="department">
                        <div className="flex items-center gap-2">
                          <Bot className="h-3.5 w-3.5" />
                          Departamento
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {destinationType === "specific_agent" && (
                    <Select value={targetAgentId} onValueChange={setTargetAgentId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione o agente" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {destinationType === "department" && (
                    <Select value={targetDepartmentId} onValueChange={setTargetDepartmentId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione o departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            {isProcessing ? "Processando..." : "Cancelar"}
          </Button>
          <Button onClick={() => sendMutation.mutate()} disabled={!canSend || isProcessing}>
            {isProcessing ? "Enviando..." : `Reengajar ${conversationIds.length} conversa${conversationIds.length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
