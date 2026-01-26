import { Users, MoreVertical, Pencil, Trash2, UserPlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTeamMembers } from "@/hooks/useTeams";
import { useTeamSettings } from "@/hooks/useTeamSettings";
import { useTeamChannels } from "@/hooks/useTeamChannels";

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  manager_id: string | null;
  manager?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface TeamCardProps {
  team: Team;
  onEdit: () => void;
  onManageMembers: () => void;
  onSettings: () => void;
  onDelete: () => void;
}

export default function TeamCard({ 
  team, 
  onEdit, 
  onManageMembers, 
  onSettings,
  onDelete 
}: TeamCardProps) {
  const { data: members } = useTeamMembers(team.id);
  const { data: settings } = useTeamSettings(team.id);
  const { data: channels } = useTeamChannels(team.id);

  return (
    <Card className="relative overflow-hidden">
      <div 
        className="absolute top-0 left-0 w-full h-1"
        style={{ backgroundColor: team.color || "#3B82F6" }}
      />
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
            style={{ backgroundColor: team.color || "#3B82F6" }}
          >
            {team.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <CardTitle className="text-lg">{team.name}</CardTitle>
            {team.description && (
              <CardDescription className="line-clamp-1">{team.description}</CardDescription>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onManageMembers}>
              <UserPlus className="h-4 w-4 mr-2" />
              Gerenciar Membros
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSettings}>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar Time
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Desativar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Manager */}
          {team.manager && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Gestor:</span>
              <Avatar className="h-5 w-5">
                <AvatarImage src={team.manager.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {team.manager.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <span>{team.manager.full_name}</span>
            </div>
          )}

          {/* Department */}
          {settings?.department && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Departamento:</span>
              <Badge 
                variant="outline" 
                style={{ 
                  borderColor: settings.department.color,
                  color: settings.department.color 
                }}
              >
                {settings.department.name}
              </Badge>
            </div>
          )}

          {/* Channels */}
          {channels && channels.length > 0 && (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="text-muted-foreground">Canais:</span>
              {channels.map((tc) => (
                <Badge 
                  key={tc.id} 
                  variant="secondary"
                  className="text-xs"
                  style={{ 
                    backgroundColor: tc.channel?.color ? `${tc.channel.color}20` : undefined,
                    color: tc.channel?.color 
                  }}
                >
                  {tc.channel?.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Concurrent Chats Limit */}
          {settings && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Limite:</span>
              <span>{settings.max_concurrent_chats} chats/agente</span>
              {!settings.auto_assign && (
                <Badge variant="outline" className="text-xs">Manual</Badge>
              )}
            </div>
          )}

          {/* Members */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {members?.length || 0} membros
              </span>
            </div>
            <div className="flex -space-x-2">
              {members?.slice(0, 5).map((member) => (
                <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
                  <AvatarImage src={member.user?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {member.user?.full_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {(members?.length || 0) > 5 && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                  +{members!.length - 5}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={onManageMembers}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Membros
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={onSettings}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
