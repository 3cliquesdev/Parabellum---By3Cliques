import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, AlertTriangle, Banknote, Loader2 } from "lucide-react";
import { useTicketApproval } from "@/hooks/useTicketApproval";
import { useUpdateTicket } from "@/hooks/useUpdateTicket";

interface FinancialApprovalBarProps {
  ticketId: string;
  ticketStatus: string;
  hasEvidence: boolean;
  ticketCategory?: string;
}

export function FinancialApprovalBar({ ticketId, ticketStatus, hasEvidence, ticketCategory }: FinancialApprovalBarProps) {
  // Saques não exigem evidência para aprovação
  const isWithdrawal = ticketCategory === 'saque' || ticketCategory === 'saque_carteira';
  const requiresEvidence = !isWithdrawal;
  const canApprove = hasEvidence || !requiresEvidence;
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const { mutate: approveTicket, isPending: isApproving } = useTicketApproval();
  const updateTicket = useUpdateTicket();

  const handleApprove = () => {
    approveTicket(
      { ticket_id: ticketId, approved: true },
      {
        onSuccess: () => {
          setApproveDialogOpen(false);
        },
      }
    );
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      return;
    }
    
    approveTicket(
      { 
        ticket_id: ticketId, 
        approved: false,
        rejection_reason: rejectionReason 
      },
      {
        onSuccess: () => {
          setRejectDialogOpen(false);
          setRejectionReason("");
        },
      }
    );
  };

  const handleComplete = () => {
    updateTicket.mutate(
      { id: ticketId, updates: { status: 'resolved' } },
      {
        onSuccess: () => {
          setCompleteDialogOpen(false);
        },
      }
    );
  };

  // Não mostra para tickets resolvidos ou fechados
  if (ticketStatus === 'resolved' || ticketStatus === 'closed') {
    return null;
  }

  const isPendingApproval = ticketStatus === 'pending_approval';
  const isApproved = ticketStatus === 'approved';

  // Estado 2: Já aprovado - aguardando execução do pagamento
  if (isApproved) {
    return (
      <>
        <Card className="border-2 border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Banknote className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  💰 Reembolso Aprovado - Aguardando Pagamento
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Execute o pagamento e clique em "Concluir" para finalizar o ticket.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setCompleteDialogOpen(true)}
                disabled={updateTicket.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateTicket.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Concluir Reembolso
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Complete Dialog */}
        <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Confirmar Conclusão do Reembolso
              </AlertDialogTitle>
              <AlertDialogDescription>
                Você está confirmando que o pagamento foi <strong>executado</strong>. Esta ação:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Marcará o ticket como <strong>Resolvido</strong></li>
                  <li>Notificará o cliente sobre a conclusão</li>
                  <li><strong>Esta ação não pode ser desfeita</strong></li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleComplete}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={updateTicket.isPending}
              >
                {updateTicket.isPending ? "Concluindo..." : "Confirmar Conclusão"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Estado: Sem solicitação formal de aprovação - apenas informativo
  if (!isPendingApproval) {
    return (
      <Card className="border border-muted bg-muted/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <Banknote className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">
                💰 Ticket Financeiro
              </h3>
              <p className="text-sm text-muted-foreground">
                Aguardando solicitação de aprovação pelo agente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado 1: Aguardando aprovação (pending_approval)
  return (
    <>
      <Card className="border-2 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-yellow-500/10">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                ⚖️ Aprovação Gerencial Pendente
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Este ticket aguarda sua decisão para aprovar ou rejeitar o reembolso.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isApproving}
                className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={() => setApproveDialogOpen(true)}
                disabled={isApproving || !canApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar Reembolso
              </Button>
            </div>
          </div>

          {!canApprove && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">
                ⚠️ <strong>Atenção:</strong> Este ticket não possui evidências anexadas. 
                Não é possível aprovar sem comprovação.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Confirmar Aprovação de Reembolso
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a <strong>aprovar</strong> este reembolso. Esta ação:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Marcará o ticket como <strong>Aprovado</strong> para pagamento</li>
                <li>Registrará sua aprovação no histórico</li>
                <li>Após o pagamento, você poderá marcar como Concluído</li>
                <li><strong>Esta ação não pode ser desfeita</strong></li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700"
              disabled={isApproving}
            >
              {isApproving ? "Aprovando..." : "Confirmar Aprovação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Rejeitar Reembolso
            </AlertDialogTitle>
            <AlertDialogDescription>
              Explique o motivo da rejeição. O ticket será devolvido ao Suporte com suas observações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Ex: Falta foto da etiqueta de devolução, prazo de 30 dias excedido, produto danificado por mau uso..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={isApproving || !rejectionReason.trim()}
            >
              {isApproving ? "Rejeitando..." : "Confirmar Rejeição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
