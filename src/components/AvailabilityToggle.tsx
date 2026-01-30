import { useState } from "react";
import { useAvailabilityStatus } from "@/hooks/useAvailabilityStatus";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { OfflineConfirmationDialog } from "@/components/OfflineConfirmationDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const statusConfig = {
  online: {
    label: "Online",
    icon: "🟢",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/20",
  },
  busy: {
    label: "Ocupado",
    icon: "🟡",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
  },
  away: {
    label: "Ausente",
    icon: "🟠",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/20",
  },
  offline: {
    label: "Offline",
    icon: "🔴",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
  },
} as const;

export function AvailabilityToggle() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { status, isLoading, updateStatus } = useAvailabilityStatus();
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [showBusyToOnlineDialog, setShowBusyToOnlineDialog] = useState(false);
  const [isGoingOffline, setIsGoingOffline] = useState(false);

  // Contar conversas ativas do usuário
  const { data: activeConversations = 0 } = useQuery({
    queryKey: ["active-conversations-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .in("status", ["open"]);
      
      if (error) {
        console.error("Error counting conversations:", error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!user,
  });

  const handleStatusChange = (newStatus: "online" | "busy" | "away" | "offline") => {
    if (newStatus === "offline") {
      // Mostrar dialog de confirmação antes de ficar offline
      setShowOfflineDialog(true);
    } else if (newStatus === "online" && (status === "busy" || status === "away")) {
      // Proteção anti-clique: confirmar antes de sair de Busy ou Away
      setShowBusyToOnlineDialog(true);
    } else {
      updateStatus(newStatus);
    }
  };

  const handleConfirmBusyToOnline = () => {
    updateStatus("online");
    setShowBusyToOnlineDialog(false);
  };

  const handleConfirmOffline = async () => {
    if (!user) return;
    
    setIsGoingOffline(true);
    
    try {
      // Chamar edge function para processar offline manual
      const { data, error } = await supabase.functions.invoke("go-offline-manual", {
        body: { agentId: user.id },
      });

      if (error) {
        console.error("[AvailabilityToggle] Error going offline:", error);
        toast({
          title: "Erro ao ficar offline",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log("[AvailabilityToggle] Offline result:", data);
      
      setShowOfflineDialog(false);
      
      // Mostrar resultado
      if (data.conversationsClosed > 0) {
        toast({
          title: "Você está offline",
          description: `${data.conversationsClosed} conversa(s) encerrada(s). ${data.csatSent} pesquisa(s) de satisfação enviada(s).`,
        });
      } else {
        toast({
          title: "Você está offline",
          description: "Você não receberá novas conversas.",
        });
      }
    } catch (err) {
      console.error("[AvailabilityToggle] Exception:", err);
      toast({
        title: "Erro ao ficar offline",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGoingOffline(false);
    }
  };

  if (isLoading || !status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  const currentConfig = statusConfig[status];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`justify-start gap-2 ${currentConfig.bg} ${currentConfig.color} hover:${currentConfig.bg}`}
          >
            <span className="text-base">{currentConfig.icon}</span>
            <span className="font-medium">{currentConfig.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => handleStatusChange("online")}
            disabled={status === "online"}
            className="gap-2"
          >
            <span className="text-base">{statusConfig.online.icon}</span>
            <div className="flex flex-col">
              <span className="font-medium">{statusConfig.online.label}</span>
              <span className="text-xs text-muted-foreground">Recebe chats</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatusChange("busy")}
            disabled={status === "busy"}
            className="gap-2"
          >
            <span className="text-base">{statusConfig.busy.icon}</span>
            <div className="flex flex-col">
              <span className="font-medium">{statusConfig.busy.label}</span>
              <span className="text-xs text-muted-foreground">Não recebe novos</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatusChange("away")}
            disabled={status === "away"}
            className="gap-2"
          >
            <span className="text-base">{statusConfig.away.icon}</span>
            <div className="flex flex-col">
              <span className="font-medium">{statusConfig.away.label}</span>
              <span className="text-xs text-muted-foreground">Temporariamente indisponível</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleStatusChange("offline")}
            disabled={status === "offline"}
            className="gap-2"
          >
            <span className="text-base">{statusConfig.offline.icon}</span>
            <div className="flex flex-col">
              <span className="font-medium">{statusConfig.offline.label}</span>
              <span className="text-xs text-muted-foreground">Para de receber</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <OfflineConfirmationDialog
        open={showOfflineDialog}
        onOpenChange={setShowOfflineDialog}
        activeConversations={activeConversations}
        onConfirm={handleConfirmOffline}
        isLoading={isGoingOffline}
      />

      {/* Dialog de confirmação para Busy → Online */}
      <AlertDialog open={showBusyToOnlineDialog} onOpenChange={setShowBusyToOnlineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voltar para Online?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está no status <strong>"Ocupado"</strong>. Ao voltar para Online, 
                você passará a receber novas conversas automaticamente.
              </p>
              <p className="text-warning font-medium">
                ⚠️ Tem certeza que deseja continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBusyToOnline}>
              Confirmar - Ficar Online
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
