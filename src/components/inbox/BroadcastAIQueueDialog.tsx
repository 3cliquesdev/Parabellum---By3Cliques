import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBroadcastProgress, BroadcastJob } from "@/hooks/useBroadcastProgress";
import { AlertTriangle, Send, TestTube, CheckCircle, XCircle, Ban, Loader2 } from "lucide-react";

interface BroadcastAIQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueCount: number;
}

const DEFAULT_MESSAGE = `Olá! 👋 Sou a assistente virtual. 

Tivemos uma instabilidade técnica e sua mensagem pode não ter sido respondida. 

Ainda precisa de atendimento? Responda aqui que já te ajudo! 🚀`;

type DialogMode = "compose" | "monitoring";

export function BroadcastAIQueueDialog({
  open,
  onOpenChange,
  queueCount,
}: BroadcastAIQueueDialogProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [dryRun, setDryRun] = useState(true);
  const [mode, setMode] = useState<DialogMode>("compose");
  const [isStarting, setIsStarting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<{ total: number } | null>(null);

  // Realtime progress hook
  const { job, progressPercent, cancelJob, isLoading: isLoadingJob } = useBroadcastProgress({
    jobId: activeJobId,
    onComplete: (completedJob) => {
      toast({
        title: completedJob.status === "cancelled" ? "⏹️ Broadcast cancelado" : "📢 Broadcast concluído!",
        description: `${completedJob.sent} enviados, ${completedJob.failed} falhas`,
      });
    },
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode("compose");
      setActiveJobId(null);
      setDryRunResult(null);
      setDryRun(true);
      setIsStarting(false);
    }
  }, [open]);

  const handleBroadcast = async () => {
    if (!message.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem para enviar.",
        variant: "destructive",
      });
      return;
    }

    setIsStarting(true);

    try {
      const { data, error } = await supabase.functions.invoke("broadcast-ai-queue", {
        body: {
          message: message.trim(),
          dry_run: dryRun,
          limit: 500,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (dryRun) {
        // Dry run - show preview
        setDryRunResult({ total: data.total });
        toast({
          title: "🧪 Teste concluído",
          description: `${data.total} conversas seriam notificadas.`,
        });
      } else {
        // Real broadcast - switch to monitoring mode
        setActiveJobId(data.job_id);
        setMode("monitoring");
        toast({
          title: "📢 Broadcast iniciado!",
          description: `Enviando para ${data.total} conversas...`,
        });
      }
    } catch (error) {
      console.error("[BroadcastAIQueueDialog] Error:", error);
      toast({
        title: "Erro no broadcast",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    await cancelJob();
    toast({
      title: "⏹️ Cancelando...",
      description: "O broadcast será interrompido em breve.",
    });
  };

  const handleClose = () => {
    // Allow closing even during monitoring - job continues in background
    if (mode === "monitoring" && job?.status === "running") {
      toast({
        title: "ℹ️ Broadcast continua",
        description: "O envio continuará em segundo plano.",
      });
    }
    onOpenChange(false);
  };

  const isJobActive = job?.status === "running" || job?.status === "pending";
  const isJobComplete = job?.status === "completed" || job?.status === "cancelled" || job?.status === "failed";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📢 Broadcast para Fila da IA
          </DialogTitle>
          <DialogDescription>
            {mode === "compose"
              ? "Envie uma mensagem de reengajamento para todas as conversas WhatsApp na fila da IA."
              : "Acompanhe o progresso do envio em tempo real."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {mode === "compose" ? (
            <>
              {/* Queue Count */}
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <span className="text-sm">
                  <strong>{queueCount}</strong> conversas WhatsApp serão notificadas
                </span>
              </div>

              {/* Message Input */}
              <div className="space-y-2">
                <Label htmlFor="broadcast-message">Mensagem</Label>
                <Textarea
                  id="broadcast-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite a mensagem..."
                  rows={6}
                  disabled={isStarting}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {message.length} caracteres
                </p>
              </div>

              {/* Dry Run Toggle */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dry-run"
                  checked={dryRun}
                  onCheckedChange={(checked) => {
                    setDryRun(checked === true);
                    setDryRunResult(null);
                  }}
                  disabled={isStarting}
                />
                <Label htmlFor="dry-run" className="text-sm font-normal cursor-pointer">
                  Modo teste (não envia de verdade)
                </Label>
              </div>

              {/* Dry Run Result */}
              {dryRunResult && (
                <div className="p-3 border rounded-lg bg-card flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-primary" />
                  <span className="text-sm">
                    Teste OK: <strong>{dryRunResult.total}</strong> conversas seriam notificadas
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Monitoring Mode */}
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {job?.status === "running" && "📤 Enviando..."}
                    {job?.status === "pending" && "⏳ Iniciando..."}
                    {job?.status === "completed" && "✅ Concluído!"}
                    {job?.status === "cancelled" && "⏹️ Cancelado"}
                    {job?.status === "failed" && "❌ Falhou"}
                  </span>
                  {isJobActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      className="text-destructive"
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {job ? `${job.sent + job.failed + job.skipped}/${job.total}` : "0/0"}
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
                </div>

                {/* Stats Grid */}
                {job && (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 bg-success/10 rounded text-center">
                      <div className="text-lg font-bold text-success">{job.sent}</div>
                      <div className="text-xs text-muted-foreground">Enviados</div>
                    </div>
                    <div className="p-2 bg-destructive/10 rounded text-center">
                      <div className="text-lg font-bold text-destructive">{job.failed}</div>
                      <div className="text-xs text-muted-foreground">Falhas</div>
                    </div>
                    <div className="p-2 bg-muted rounded text-center">
                      <div className="text-lg font-bold">{job.skipped}</div>
                      <div className="text-xs text-muted-foreground">Pulados</div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {job?.error_message && (
                  <div className="p-3 border border-destructive rounded-lg bg-destructive/10 flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <span className="text-sm text-destructive">{job.error_message}</span>
                  </div>
                )}

                {/* Completion Message */}
                {isJobComplete && (
                  <div className="p-3 border rounded-lg bg-card flex items-center gap-2">
                    {job?.status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : job?.status === "cancelled" ? (
                      <Ban className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="text-sm">
                      {job?.status === "completed" && "Broadcast enviado com sucesso!"}
                      {job?.status === "cancelled" && "Broadcast foi cancelado."}
                      {job?.status === "failed" && "Broadcast falhou."}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {mode === "monitoring" && isJobComplete ? "Fechar" : "Cancelar"}
          </Button>

          {mode === "compose" && (
            <Button
              onClick={handleBroadcast}
              disabled={isStarting || !message.trim()}
              variant={dryRun ? "secondary" : "default"}
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {dryRun ? "Testando..." : "Iniciando..."}
                </>
              ) : dryRun ? (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Testar
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Broadcast
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
