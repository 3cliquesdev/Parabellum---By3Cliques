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
import { AlertTriangle, Send, TestTube, CheckCircle, XCircle } from "lucide-react";

interface BroadcastAIQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueCount: number;
}

const DEFAULT_MESSAGE = `Olá! 👋 Sou a assistente virtual da 3Cliques. 

Tivemos uma instabilidade técnica e sua mensagem pode não ter sido respondida. 

Ainda precisa de atendimento? Responda aqui que já te ajudo! 🚀`;

type BroadcastStatus = "idle" | "loading" | "sending" | "complete" | "error";

interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  dry_run?: boolean;
  message?: string;
  broadcast_id?: string;
  elapsed_ms?: number;
}

export function BroadcastAIQueueDialog({
  open,
  onOpenChange,
  queueCount,
}: BroadcastAIQueueDialogProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [dryRun, setDryRun] = useState(true);
  const [status, setStatus] = useState<BroadcastStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setProgress(0);
      setResult(null);
      setDryRun(true);
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

    setStatus(dryRun ? "loading" : "sending");
    setProgress(10);

    try {
      // Simulate progress while waiting
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke("broadcast-ai-queue", {
        body: {
          message: message.trim(),
          dry_run: dryRun,
          limit: 500,
        },
      });

      clearInterval(progressInterval);

      if (error) {
        throw new Error(error.message);
      }

      setProgress(100);
      setResult(data);
      setStatus("complete");

      if (dryRun) {
        toast({
          title: "🧪 Teste concluído",
          description: `${data.total} conversas seriam notificadas.`,
        });
      } else {
        toast({
          title: "📢 Broadcast enviado!",
          description: `${data.sent} mensagens enviadas, ${data.failed} falhas.`,
        });
      }
    } catch (error) {
      console.error("[BroadcastAIQueueDialog] Error:", error);
      setStatus("error");
      toast({
        title: "Erro no broadcast",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (status === "sending") {
      return; // Don't allow closing while sending
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📢 Broadcast para Fila da IA
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem de reengajamento para todas as conversas na fila
            da IA que não foram respondidas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              disabled={status === "sending"}
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
              onCheckedChange={(checked) => setDryRun(checked === true)}
              disabled={status === "sending"}
            />
            <Label
              htmlFor="dry-run"
              className="text-sm font-normal cursor-pointer"
            >
              Modo teste (não envia de verdade)
            </Label>
          </div>

          {/* Progress Bar */}
          {(status === "loading" || status === "sending") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{dryRun ? "Verificando..." : "Enviando mensagens..."}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Results */}
          {status === "complete" && result && (
            <div className="p-4 border rounded-lg bg-card space-y-2">
              <div className="flex items-center gap-2">
                {result.dry_run ? (
                  <TestTube className="h-5 w-5 text-primary" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-success" />
                )}
                <span className="font-medium">
                  {result.dry_run ? "Resultado do Teste" : "Broadcast Concluído"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 bg-muted rounded text-center">
                  <div className="text-lg font-bold">{result.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="p-2 bg-success/10 rounded text-center">
                  <div className="text-lg font-bold text-success">{result.sent}</div>
                  <div className="text-xs text-muted-foreground">Enviados</div>
                </div>
                <div className="p-2 bg-destructive/10 rounded text-center">
                  <div className="text-lg font-bold text-destructive">{result.failed}</div>
                  <div className="text-xs text-muted-foreground">Falhas</div>
                </div>
              </div>
              {result.elapsed_ms && (
                <p className="text-xs text-muted-foreground text-right">
                  Tempo: {(result.elapsed_ms / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="p-4 border border-destructive rounded-lg bg-destructive/10 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm text-destructive">
                Erro ao executar broadcast. Tente novamente.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={status === "sending"}
          >
            {status === "complete" ? "Fechar" : "Cancelar"}
          </Button>
          
          {status !== "complete" && (
            <Button
              onClick={handleBroadcast}
              disabled={status === "loading" || status === "sending" || !message.trim()}
              variant={dryRun ? "secondary" : "default"}
            >
              {status === "sending" ? (
                "Enviando..."
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
