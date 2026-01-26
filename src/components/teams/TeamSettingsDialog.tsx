import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeams } from "@/hooks/useTeams";
import { useTeamSettings, useUpsertTeamSettings } from "@/hooks/useTeamSettings";
import { useTeamChannels, useUpdateTeamChannels } from "@/hooks/useTeamChannels";
import { useDepartments } from "@/hooks/useDepartments";
import { useSupportChannels } from "@/hooks/useSupportChannels";

interface TeamSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
}

export default function TeamSettingsDialog({ open, onOpenChange, teamId }: TeamSettingsDialogProps) {
  const { data: teams } = useTeams();
  const { data: settings, isLoading: settingsLoading } = useTeamSettings(teamId);
  const { data: teamChannels } = useTeamChannels(teamId);
  const { data: departments } = useDepartments({ activeOnly: true });
  const { data: supportChannels } = useSupportChannels();
  
  const upsertSettings = useUpsertTeamSettings();
  const updateChannels = useUpdateTeamChannels();

  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [maxConcurrentChats, setMaxConcurrentChats] = useState(5);
  const [autoAssign, setAutoAssign] = useState(true);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const team = teams?.find(t => t.id === teamId);

  // Load initial values
  useEffect(() => {
    if (settings) {
      setDepartmentId(settings.department_id);
      setMaxConcurrentChats(settings.max_concurrent_chats);
      setAutoAssign(settings.auto_assign);
    }
  }, [settings]);

  useEffect(() => {
    if (teamChannels) {
      setSelectedChannels(teamChannels.map(tc => tc.channel_id));
    }
  }, [teamChannels]);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleSave = async () => {
    try {
      await upsertSettings.mutateAsync({
        teamId,
        departmentId,
        maxConcurrentChats,
        autoAssign,
      });
      
      await updateChannels.mutateAsync({
        teamId,
        channelIds: selectedChannels,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving team settings:", error);
    }
  };

  const isSaving = upsertSettings.isPending || updateChannels.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{ backgroundColor: team?.color || "#3B82F6" }}
            >
              <Settings className="h-4 w-4 text-white" />
            </div>
            Configurações - {team?.name}
          </DialogTitle>
        </DialogHeader>

        {settingsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Department */}
            <div className="space-y-2">
              <Label>Departamento Padrão</Label>
              <Select 
                value={departmentId || "none"} 
                onValueChange={(v) => setDepartmentId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: dept.color }}
                        />
                        {dept.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Conversas serão direcionadas para este departamento por padrão
              </p>
            </div>

            {/* Max Concurrent Chats */}
            <div className="space-y-2">
              <Label>Limite de Atendimentos Simultâneos</Label>
              <Input 
                type="number" 
                min={1} 
                max={50}
                value={maxConcurrentChats}
                onChange={(e) => setMaxConcurrentChats(parseInt(e.target.value) || 5)}
              />
              <p className="text-xs text-muted-foreground">
                Máximo de conversas que cada agente pode atender ao mesmo tempo
              </p>
            </div>

            {/* Auto Assign */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Distribuição Automática</Label>
                <p className="text-xs text-muted-foreground">
                  Atribuir conversas automaticamente aos membros online
                </p>
              </div>
              <Switch 
                checked={autoAssign}
                onCheckedChange={setAutoAssign}
              />
            </div>

            {/* Support Channels */}
            <div className="space-y-2">
              <Label>Canais de Atendimento</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Selecione os canais que este time irá atender
              </p>
              <ScrollArea className="h-[150px] border rounded-lg p-3">
                <div className="space-y-2">
                  {supportChannels?.map((channel) => {
                    const isSelected = selectedChannels.includes(channel.id);
                    return (
                      <div 
                        key={channel.id}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10" : "hover:bg-muted"
                        }`}
                        onClick={() => toggleChannel(channel.id)}
                      >
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleChannel(channel.id)}
                        />
                        <Badge
                          style={{ 
                            backgroundColor: `${channel.color}20`,
                            color: channel.color 
                          }}
                        >
                          {channel.name}
                        </Badge>
                      </div>
                    );
                  })}
                  {supportChannels?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum canal cadastrado
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
