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
import { Loader2 } from "lucide-react";

interface OfflineConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeConversations: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function OfflineConfirmationDialog({
  open,
  onOpenChange,
  activeConversations,
  onConfirm,
  isLoading,
}: OfflineConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Ficar Offline
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {activeConversations > 0 ? (
                <p className="text-base font-medium text-foreground">
                  Você tem <span className="text-primary font-bold">{activeConversations}</span> conversa(s) em andamento.
                </p>
              ) : (
                <p className="text-base">
                  Você não tem conversas ativas no momento.
                </p>
              )}
              
              {/* CONTRATO v2.2 §11: UI deve refletir comportamento real */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="font-medium text-foreground">Ao ficar offline:</p>
                <ul className="list-none space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground">⏸</span>
                    <span>Você <strong>deixará de receber</strong> novas conversas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Suas conversas atuais <strong>permanecerão abertas</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Elas entrarão na <strong>fila de atendimento</strong> para redistribuição</span>
                  </li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              "Confirmar e Ficar Offline"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
