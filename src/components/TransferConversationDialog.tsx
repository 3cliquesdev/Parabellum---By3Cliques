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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useDepartments } from "@/hooks/useDepartments";
import { useUsersByDepartment } from "@/hooks/useUsersByDepartment";
import { useTransferConversation } from "@/hooks/useTransferConversation";
import { ArrowRightLeft, Users } from "lucide-react";
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
  conversation: Conversation | null;
  currentUserId: string;
}

export default function TransferConversationDialog({
  open,
  onOpenChange,
  conversation,
  currentUserId,
}: TransferConversationDialogProps) {
  // Early return se não há conversa selecionada ou contato
  if (!conversation || !conversation.contacts) {
    return null;
  }

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [transferNote, setTransferNote] = useState("");
  
  const { data: departments } = useDepartments();
  const { data: users, isLoading } = useUsersByDepartment(selectedDepartmentId || undefined);
  const transferMutation = useTransferConversation();

  const handleTransfer = () => {
    // Agente é opcional - se não selecionou, usa distribuição automática
    if (!selectedDepartmentId || !transferNote.trim()) return;

    const isAutoDistribute = !selectedUserId || selectedUserId === "auto";
    const toUser = isAutoDistribute ? null : users?.find((u) => u.id === selectedUserId);
    const toDepartment = departments?.find((d) => d.id === selectedDepartmentId);
    if (!toDepartment) return;
    if (!isAutoDistribute && !toUser) return;

    const fromUser = conversation.assigned_user || {
      id: currentUserId,
      full_name: "Usuário atual",
    };

    transferMutation.mutate(
      {
        conversationId: conversation.id,
        fromUserId: fromUser.id,
        toUserId: isAutoDistribute ? null : selectedUserId,
        fromUserName: fromUser.full_name,
        toUserName: isAutoDistribute ? "Distribuição Automática" : toUser!.full_name,
        contactId: conversation.contact_id,
        departmentId: selectedDepartmentId,
        departmentName: toDepartment.name,
        transferNote: transferNote.trim(),
        autoDistribute: isAutoDistribute,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedUserId(null);
          setSelectedDepartmentId(null);
          setTransferNote("");
        },
      }
    );
  };

  // Filtrar usuário atribuído atual da lista
  const availableUsers = users?.filter(
    (user) => user.id !== conversation.assigned_to
  );

  const activeDepartments = departments?.filter((d) => d.is_active) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <ArrowRightLeft className="h-5 w-5" />
            Transferir Conversa
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Selecione o departamento e o agente que ficará responsável por esta conversa com{" "}
            <strong className="text-foreground">{conversation.contacts?.first_name} {conversation.contacts?.last_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Select de Departamento */}
          <div className="space-y-2">
            <Label htmlFor="department">Departamento de Destino *</Label>
            <Select
              value={selectedDepartmentId || ""}
              onValueChange={(value) => {
                setSelectedDepartmentId(value);
                setSelectedUserId(null); // Reset user selection when department changes
              }}
            >
              <SelectTrigger id="department">
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                {activeDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Usuários (só aparece após selecionar departamento) */}
          {selectedDepartmentId && (
            <>
              <div className="space-y-2">
                <Label>Agente de Destino <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <ScrollArea className="h-[240px]">
                    <div className="space-y-2 pr-4">
                      {/* Opção de distribuição automática */}
                      <button
                        onClick={() => setSelectedUserId("auto")}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-accent ${
                          selectedUserId === "auto" || !selectedUserId
                            ? "border-primary bg-accent"
                            : "border-border"
                        }`}
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">Distribuir Automaticamente</p>
                          <p className="text-sm text-muted-foreground">
                            Distribui entre agentes online do departamento
                          </p>
                        </div>
                      </button>

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
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                user.availability_status === "online" ? "bg-green-500" : 
                                user.availability_status === "busy" ? "bg-yellow-500" : 
                                "bg-gray-400"
                              }`} />
                              <p className="font-medium">{user.full_name}</p>
                              {user.availability_status === "online" && (
                                <span className="text-xs text-green-600 font-medium">Online</span>
                              )}
                              {user.availability_status === "busy" && (
                                <span className="text-xs text-yellow-600 font-medium">Ocupado</span>
                              )}
                            </div>
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
                          Nenhum usuário disponível neste departamento
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Campo de Nota de Transferência */}
              <div className="space-y-2">
                <Label htmlFor="transferNote">Nota de Transferência *</Label>
                <Textarea
                  id="transferNote"
                  placeholder="Ex: Cliente está irritado com atraso na entrega, precisa atenção urgente..."
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Esta nota será visível apenas para a equipe interna
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedDepartmentId(null);
              setSelectedUserId(null);
              setTransferNote("");
            }}
            disabled={transferMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedDepartmentId || !transferNote.trim() || transferMutation.isPending}
          >
            {transferMutation.isPending ? "Transferindo..." : "Confirmar Transferência"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
