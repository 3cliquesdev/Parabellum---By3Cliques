import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProjectMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}

export function ProjectMembersDialog({ open, onOpenChange, boardId }: ProjectMembersDialogProps) {
  const [search, setSearch] = useState("");

  // Get all profiles that have assignments in this board's cards
  const { data: assignedMembers = [] } = useQuery({
    queryKey: ["project-members", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_card_assignees")
        .select(`
          profile_id,
          profiles:profile_id (id, full_name, avatar_url, email)
        `)
        .eq("card_id", boardId); // This will be adjusted

      // Actually get via cards
      const { data: cards } = await supabase
        .from("project_cards")
        .select("id")
        .eq("board_id", boardId);

      if (!cards?.length) return [];

      const cardIds = cards.map(c => c.id);
      
      const { data: assignees } = await supabase
        .from("project_card_assignees")
        .select(`
          profile_id,
          profiles:profile_id (id, full_name, avatar_url, email)
        `)
        .in("card_id", cardIds);

      // Deduplicate by profile_id
      const uniqueProfiles = new Map();
      assignees?.forEach((a: any) => {
        if (a.profiles && !uniqueProfiles.has(a.profile_id)) {
          uniqueProfiles.set(a.profile_id, a.profiles);
        }
      });

      return Array.from(uniqueProfiles.values());
    },
    enabled: open && !!boardId,
  });

  // Get all available profiles
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const filteredProfiles = allProfiles.filter((p) =>
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const assignedIds = new Set(assignedMembers.map((m: any) => m.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Membros do Projeto</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {filteredProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>
                    {profile.full_name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{profile.full_name || "Sem nome"}</p>
                </div>
                {assignedIds.has(profile.id) && (
                  <Badge variant="secondary" className="text-xs">Ativo</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <p className="text-xs text-muted-foreground text-center">
          {assignedMembers.length} membro(s) com tarefas atribuídas
        </p>
      </DialogContent>
    </Dialog>
  );
}
