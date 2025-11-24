import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSalesReps } from "@/hooks/useSalesReps";
import { useTransferConversation } from "@/hooks/useTransferConversation";
import { ArrowRightLeft } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations"> & {
  contacts: Contact;
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
  } | null;
};

interface TransferConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  currentUserId: string;
}

export default function TransferConversationDialog({
  open,
  onOpenChange,
  conversation,
  currentUserId,
}: TransferConversationDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: users, isLoading } = useSalesReps();
  const transferMutation = useTransferConversation();

  const handleTransfer = () => {
    if (!selectedUserId) return;

    const toUser = users?.find((u) => u.id === selectedUserId);
    if (!toUser) return;

    const fromUser = conversation.assigned_user || {
      id: currentUserId,
      full_name: "Usuário atual",
    };

    transferMutation.mutate(
      {
        conversationId: conversation.id,
        fromUserId: fromUser.id,
        toUserId: selectedUserId,
        fromUserName: fromUser.full_name,
        toUserName: toUser.full_name,
        contactId: conversation.contact_id,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedUserId(null);
        },
      }
    );
  };

  // Filtrar usuário atribuído atual da lista
  const availableUsers = users?.filter(
    (user) => user.id !== conversation.assigned_to
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferir Conversa
          </DialogTitle>
          <DialogDescription>
            Selecione o usuário que ficará responsável por esta conversa com{" "}
            <strong>{conversation.contacts.first_name} {conversation.contacts.last_name}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-2">
                {availableUsers?.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-accent ${
                      selectedUserId === user.id
                        ? "border-primary bg-accent"
                        : "border-border"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={user.avatar_url || undefined}
                        alt={user.full_name}
                      />
                      <AvatarFallback>
                        {user.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{user.full_name}</p>
                      {user.job_title && (
                        <p className="text-sm text-muted-foreground">
                          {user.job_title}
                        </p>
                      )}
                    </div>
                  </button>
                ))}

                {(!availableUsers || availableUsers.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum usuário disponível para transferência
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={transferMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={!selectedUserId || transferMutation.isPending}
              >
                {transferMutation.isPending ? "Transferindo..." : "Confirmar Transferência"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
