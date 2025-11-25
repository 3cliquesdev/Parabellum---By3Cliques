import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { useCloseConversation } from "@/hooks/useCloseConversation";

interface Conversation {
  id: string;
  contact_id: string;
  contacts?: {
    first_name: string;
    last_name: string;
  };
}

interface CloseConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  userId: string;
}

export default function CloseConversationDialog({
  open,
  onOpenChange,
  conversation,
  userId,
}: CloseConversationDialogProps) {
  const [sendSurvey, setSendSurvey] = useState(true);
  const closeConversation = useCloseConversation();

  const handleClose = () => {
    closeConversation.mutate(
      {
        conversationId: conversation.id,
        userId,
        sendSurvey,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const customerName = conversation.contacts
    ? `${conversation.contacts.first_name} ${conversation.contacts.last_name}`
    : "este cliente";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Encerrar Conversa
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Você está encerrando a conversa com <strong>{customerName}</strong>.
            </p>
            
            <div className="flex items-start space-x-2 rounded-lg border border-border bg-muted/50 p-3">
              <Checkbox
                id="send-survey"
                checked={sendSurvey}
                onCheckedChange={(checked) => setSendSurvey(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="send-survey"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Enviar pesquisa de satisfação
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recomendado para coleta de feedback
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={closeConversation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClose}
            disabled={closeConversation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {closeConversation.isPending ? "Encerrando..." : "Encerrar Conversa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
