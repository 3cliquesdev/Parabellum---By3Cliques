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
import { CheckCircle, AlertTriangle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCloseConversation } from "@/hooks/useCloseConversation";
import { useConversationCloseSettings } from "@/hooks/useConversationCloseSettings";
import { useConversationTags } from "@/hooks/useTags";

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
  conversation: Conversation | null;
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
  const { tagsRequired, isLoading: loadingSettings } = useConversationCloseSettings();
  const { data: conversationTags = [], isLoading: loadingTags } = useConversationTags(conversation?.id);

  if (!conversation) return null;

  const hasConversationTags = conversationTags.some(t => t.category === "conversation");
  const missingTags = tagsRequired && !hasConversationTags && !loadingSettings && !loadingTags;

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
          <AlertDialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Encerrar Conversa
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Você está encerrando a conversa com <strong className="text-foreground">{customerName}</strong>.
              </p>

              {missingTags && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-2">
                    <p className="font-medium text-destructive">Tags de conversa obrigatórias</p>
                    <p className="text-xs text-muted-foreground">
                      Adicione pelo menos uma tag da categoria <strong>"conversa"</strong> antes de encerrar. Tags pessoais ou de contato não são válidas para esta exigência.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                      className="mt-1"
                    >
                      <Tag className="h-3.5 w-3.5 mr-1.5" />
                      Adicionar Tags
                    </Button>
                  </div>
                </div>
              )}
              
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
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={closeConversation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleClose}
            disabled={closeConversation.isPending || missingTags}
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
