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
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useTicketApproval } from "@/hooks/useTicketApproval";

interface FinancialApprovalBarProps {
  ticketId: string;
  ticketStatus: string;
  hasEvidence: boolean;
}

export function FinancialApprovalBar({ ticketId, ticketStatus, hasEvidence }: FinancialApprovalBarProps) {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const { mutate: approveTicket, isPending } = useTicketApproval();

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

  // Só mostra para tickets em progresso ou aguardando aprovação
  if (ticketStatus === 'resolved' || ticketStatus === 'closed') {
    return null;
  }

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
                ⚖️ Aprovação Financeira Pendente
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
                disabled={isPending}
                className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={() => setApproveDialogOpen(true)}
                disabled={isPending || !hasEvidence}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Aprovar e Pagar
              </Button>
            </div>
          </div>

          {!hasEvidence && (
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
                <li>Marcará o ticket como <strong>Resolvido</strong></li>
                <li>Registrará sua aprovação no histórico</li>
                <li>Notificará o cliente sobre a aprovação</li>
                <li><strong>Esta ação não pode ser desfeita</strong></li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700"
              disabled={isPending}
            >
              {isPending ? "Aprovando..." : "Confirmar Aprovação"}
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
              disabled={isPending || !rejectionReason.trim()}
            >
              {isPending ? "Rejeitando..." : "Confirmar Rejeição"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
