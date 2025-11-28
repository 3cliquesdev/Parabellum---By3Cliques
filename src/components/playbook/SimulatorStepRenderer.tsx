import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Mail, CheckSquare, Phone, GitBranch, UserCheck, FastForward, Eye, Lock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Node } from "reactflow";
import { PlaybookStepViewer } from "./PlaybookStepViewer";
import { EmailPreviewModal } from "./EmailPreviewModal";
import { useToast } from "@/hooks/use-toast";

interface SimulatorStepRendererProps {
  node: Node;
  emailTemplates?: any[];
  mockCustomer: { name: string; email: string };
  onComplete: (path?: "true" | "false") => void;
}

const conditionLabels: Record<string, string> = {
  email_opened: "E-mail foi aberto?",
  email_clicked: "Link no e-mail foi clicado?",
  meeting_booked: "Reunião foi agendada?",
  tag_exists: "Tag específica existe?",
  status_change: "Status mudou?",
};

export function SimulatorStepRenderer({
  node,
  emailTemplates,
  mockCustomer,
  onComplete,
}: SimulatorStepRendererProps) {
  const { toast } = useToast();
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailHtml, setEmailHtml] = useState("");
  const [emailSubject, setEmailSubject] = useState("");

  // EMAIL NODE
  if (node.type === "email") {
    const template = emailTemplates?.find((t) => t.id === node.data.template_id);
    const subject = node.data.subject || template?.subject || "Email sem assunto";
    const htmlBody = template?.html_body || "<p>Email sem conteúdo</p>";

    const handleEmailSimulation = () => {
      toast({
        title: "📧 E-mail Simulado",
        description: `"${subject}" seria enviado para ${mockCustomer.email}`,
        action: (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEmailSubject(subject);
              setEmailHtml(htmlBody);
              setEmailPreviewOpen(true);
            }}
          >
            <Eye className="h-3 w-3 mr-1" />
            Ver HTML
          </Button>
        ),
        duration: 5000,
      });

      // Auto-advance after showing toast
      setTimeout(() => onComplete(), 1000);
    };

    return (
      <>
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="font-semibold text-lg">{node.data.label}</h3>
              <p className="text-sm text-muted-foreground">Assunto: {subject}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Em produção, este e-mail seria enviado automaticamente via Resend para o cliente.
          </p>

          <div className="flex gap-2">
            <Button onClick={handleEmailSimulation} className="gap-2">
              <Mail className="h-4 w-4" />
              📧 Simular Envio
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEmailSubject(subject);
                setEmailHtml(htmlBody);
                setEmailPreviewOpen(true);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Preview
            </Button>
          </div>
        </Card>

        <EmailPreviewModal
          open={emailPreviewOpen}
          onClose={() => setEmailPreviewOpen(false)}
          htmlContent={emailHtml}
          subject={emailSubject}
          recipientEmail={mockCustomer.email}
        />
      </>
    );
  }

  // DELAY NODE
  if (node.type === "delay") {
    const days = node.data.duration_days || 1;

    return (
      <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="h-8 w-8 text-amber-600" />
          <div>
            <h3 className="font-semibold text-lg">⏳ Aguardando {days} {days === 1 ? "dia" : "dias"}...</h3>
            <p className="text-sm text-muted-foreground">
              Em produção, o próximo passo executaria após este período.
            </p>
          </div>
        </div>

        <Button onClick={() => onComplete()} className="gap-2 bg-amber-600 hover:bg-amber-700">
          <FastForward className="h-4 w-4" />
          ⏩ Avançar Tempo (Pular)
        </Button>
      </Card>
    );
  }

  // TASK NODE (Video + Quiz + Rich Content)
  if (node.type === "task") {
    const [isVideoLocked, setIsVideoLocked] = useState(false);
    const hasVideo = node.data.video_url?.trim();
    
    // DEBUG: Log estado do botão
    console.log('🎯 SimulatorStepRenderer - Estado do Botão:', {
      nodeId: node.id,
      hasVideo,
      isVideoLocked,
      video_url: node.data.video_url,
    });
    
    return (
      <div className="space-y-4">
        <PlaybookStepViewer
          label={node.data.label}
          video_url={hasVideo ? node.data.video_url : undefined}
          rich_content={node.data.rich_content}
          attachments={node.data.attachments}
          quiz_enabled={node.data.quiz_enabled}
          quiz_question={node.data.quiz_question}
          quiz_options={node.data.quiz_options}
          quiz_correct_option={node.data.quiz_correct_option}
          onVideoEnded={() => setIsVideoLocked(false)}
          onLockStateChange={setIsVideoLocked}
          onQuizPassed={() => {
            toast({
              title: "✅ Quiz Passou!",
              description: "Próximo passo desbloqueado.",
            });
          }}
        />

        {/* BOTÃO COM TRAVA VISUAL */}
        <Button 
          onClick={() => onComplete()} 
          disabled={isVideoLocked}
          className={cn(
            "w-full gap-2 transition-all",
            isVideoLocked 
              ? "bg-gray-400 cursor-not-allowed opacity-50" 
              : "bg-green-600 hover:bg-green-700 animate-pulse"
          )}
        >
          {isVideoLocked ? (
            <>
              <Lock className="h-4 w-4" />
              🔒 Assista até o final para liberar
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              ✅ Concluir e Avançar
            </>
          )}
        </Button>
      </div>
    );
  }

  // CALL NODE
  if (node.type === "call") {
    return (
      <Card className="border-violet-500 bg-violet-50 dark:bg-violet-950/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Phone className="h-8 w-8 text-violet-600" />
          <div>
            <h3 className="font-semibold text-lg">{node.data.label}</h3>
            <p className="text-sm text-muted-foreground">{node.data.description}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          📞 Tarefa de ligação registrada. Em produção, seria criada uma atividade no CRM.
        </p>

        <Button onClick={() => onComplete()} className="gap-2">
          <Phone className="h-4 w-4" />
          Simular Ligação
        </Button>
      </Card>
    );
  }

  // CONDITION NODE
  if (node.type === "condition") {
    return (
      <Card className="border-purple-500 bg-purple-50 dark:bg-purple-950/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitBranch className="h-8 w-8 text-purple-600" />
          <div>
            <h3 className="font-semibold text-lg">🔀 Ponto de Decisão</h3>
            <p className="text-sm text-muted-foreground">
              {conditionLabels[node.data.condition_type] || node.data.condition_type}
            </p>
          </div>
        </div>

        <p className="text-sm mb-4 font-medium">Simule o comportamento do cliente:</p>

        <div className="flex gap-4">
          <Button
            onClick={() => onComplete("true")}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            ✓ Condição Atendida (Sim)
          </Button>
          <Button
            onClick={() => onComplete("false")}
            variant="outline"
            className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
          >
            ✗ Não Atendida (Não)
          </Button>
        </div>
      </Card>
    );
  }

  // APPROVAL NODE
  if (node.type === "approval") {
    const roleLabels = { consultant: "Consultor", manager: "Gerente", admin: "Administrador" };
    const approverRole = roleLabels[node.data.approver_role as keyof typeof roleLabels] || "Responsável";

    return (
      <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <UserCheck className="h-8 w-8 text-orange-600" />
          <div>
            <h3 className="font-semibold text-lg">{node.data.label}</h3>
            <p className="text-sm text-muted-foreground">Aprovador: {approverRole}</p>
          </div>
        </div>

        {node.data.approval_message && (
          <p className="text-sm italic mb-4 bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded border-l-4 border-yellow-500">
            "{node.data.approval_message}"
          </p>
        )}

        <p className="text-sm text-muted-foreground mb-4">
          👤 Aprovação solicitada. Em produção, o fluxo pausaria até um humano aprovar.
        </p>

        <Button onClick={() => onComplete()} className="gap-2 bg-orange-600 hover:bg-orange-700">
          <UserCheck className="h-4 w-4" />
          Simular Aprovação
        </Button>
      </Card>
    );
  }

  // Fallback
  return (
    <Card className="p-6">
      <p className="text-muted-foreground">Tipo de nó não reconhecido: {node.type}</p>
      <Button onClick={() => onComplete()} className="mt-4">
        Próximo
      </Button>
    </Card>
  );
}
