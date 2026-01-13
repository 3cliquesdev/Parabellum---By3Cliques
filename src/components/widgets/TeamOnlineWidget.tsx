import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, RefreshCw, MoreVertical, Wifi, WifiOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useManageAvailabilityStatus } from "@/hooks/useManageAvailabilityStatus";

interface TeamMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  availability_status: string | null;
  department: { name: string } | null;
}

const statusConfig = {
  online: {
    label: "Online",
    color: "bg-green-500",
    textColor: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  busy: {
    label: "Ocupado",
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
  },
  offline: {
    label: "Offline",
    color: "bg-muted-foreground/40",
    textColor: "text-muted-foreground",
    bgColor: "bg-muted/30",
  },
};

export function TeamOnlineWidget() {
  const queryClient = useQueryClient();
  const { isAdmin, isGeneralManager, isSupportManager, isManager } = useUserRole();
  const manageAvailability = useManageAvailabilityStatus();
  
  const canManageStatus = isAdmin || isGeneralManager || isSupportManager || isManager;

  const { data: teamMembers, isLoading, refetch } = useQuery({
    queryKey: ["team-online-status"],
    queryFn: async () => {
      // Buscar usuários com roles operacionais
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", [
          "support_agent",
          "support_manager",
          "sales_rep",
          "manager",
          "consultant",
          "cs_manager",
        ]);

      if (rolesError) throw rolesError;
      if (!userRoles?.length) return [];

      const userIds = userRoles.map((ur) => ur.user_id);

      // Buscar profiles com status e nome do departamento
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id, 
          full_name, 
          avatar_url, 
          availability_status, 
          department:departments(name)
        `)
        .in("id", userIds);

      if (profilesError) throw profilesError;

      return (profiles || []) as TeamMember[];
    },
    refetchInterval: 30000, // Refresh a cada 30s
  });

  // Realtime subscription para mudanças de status
  useEffect(() => {
    const channel = supabase
      .channel("team-status-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["team-online-status"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const groupedMembers = {
    online: teamMembers?.filter((m) => m.availability_status === "online") || [],
    busy: teamMembers?.filter((m) => m.availability_status === "busy") || [],
    offline: teamMembers?.filter((m) => m.availability_status === "offline" || !m.availability_status) || [],
  };

  const counts = {
    online: groupedMembers.online.length,
    busy: groupedMembers.busy.length,
    offline: groupedMembers.offline.length,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Equipe Online</h3>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => refetch()}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Status Counters */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(["online", "busy", "offline"] as const).map((status) => (
          <div
            key={status}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-lg",
              statusConfig[status].bgColor
            )}
          >
            <div className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", statusConfig[status].color)} />
              <span className={cn("text-lg font-bold", statusConfig[status].textColor)}>
                {counts[status]}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {statusConfig[status].label}
            </span>
          </div>
        ))}
      </div>

      {/* Team List */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Online Members */}
            {groupedMembers.online.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Online ({counts.online})
                </h4>
                <div className="space-y-1">
                  {groupedMembers.online.map((member) => (
                    <TeamMemberRow 
                      key={member.id} 
                      member={member} 
                      status="online" 
                      canManageStatus={canManageStatus}
                      onChangeStatus={(newStatus) => 
                        manageAvailability.mutate({ user_id: member.id, new_status: newStatus })
                      }
                      isChanging={manageAvailability.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Busy Members */}
            {groupedMembers.busy.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Ocupado ({counts.busy})
                </h4>
                <div className="space-y-1">
                  {groupedMembers.busy.map((member) => (
                    <TeamMemberRow 
                      key={member.id} 
                      member={member} 
                      status="busy" 
                      canManageStatus={canManageStatus}
                      onChangeStatus={(newStatus) => 
                        manageAvailability.mutate({ user_id: member.id, new_status: newStatus })
                      }
                      isChanging={manageAvailability.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Offline Members (collapsed by default, show first 3) */}
            {groupedMembers.offline.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Offline ({counts.offline})
                </h4>
                <div className="space-y-1">
                  {groupedMembers.offline.slice(0, 3).map((member) => (
                    <TeamMemberRow 
                      key={member.id} 
                      member={member} 
                      status="offline" 
                      canManageStatus={canManageStatus}
                      onChangeStatus={(newStatus) => 
                        manageAvailability.mutate({ user_id: member.id, new_status: newStatus })
                      }
                      isChanging={manageAvailability.isPending}
                    />
                  ))}
                  {groupedMembers.offline.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      +{groupedMembers.offline.length - 3} offline
                    </p>
                  )}
                </div>
              </div>
            )}

            {teamMembers?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum membro da equipe encontrado
              </p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function TeamMemberRow({ 
  member, 
  status,
  canManageStatus,
  onChangeStatus,
  isChanging
}: { 
  member: TeamMember; 
  status: "online" | "busy" | "offline";
  canManageStatus: boolean;
  onChangeStatus: (newStatus: "online" | "busy" | "offline") => void;
  isChanging: boolean;
}) {
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group">
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={member.avatar_url || undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(member.full_name)}
          </AvatarFallback>
        </Avatar>
        <div 
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
            statusConfig[status].color
          )} 
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {member.full_name || "Sem nome"}
        </p>
      {member.department?.name && (
          <p className="text-xs text-muted-foreground truncate">
            {member.department.name}
          </p>
        )}
      </div>
      
      {canManageStatus && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={isChanging}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem 
              onClick={() => onChangeStatus("online")}
              disabled={status === "online"}
              className="gap-2"
            >
              <Wifi className="h-4 w-4 text-green-500" />
              Colocar Online
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onChangeStatus("busy")}
              disabled={status === "busy"}
              className="gap-2"
            >
              <Clock className="h-4 w-4 text-yellow-500" />
              Colocar Ocupado
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onChangeStatus("offline")}
              disabled={status === "offline"}
              className="gap-2"
            >
              <WifiOff className="h-4 w-4 text-muted-foreground" />
              Colocar Offline (Férias)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
