import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LinkedPlaybooksInfoProps {
  productId: string;
}

export function LinkedPlaybooksInfo({ productId }: LinkedPlaybooksInfoProps) {
  const navigate = useNavigate();

  const { data: linkedPlaybooks = [], isLoading } = useQuery({
    queryKey: ["product-linked-playbooks", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbook_products")
        .select(`
          playbook_id,
          playbook:onboarding_playbooks(id, name, is_active)
        `)
        .eq("product_id", productId);

      if (error) throw error;
      return (data || []) as Array<{
        playbook_id: string;
        playbook: { id: string; name: string; is_active: boolean } | null;
      }>;
    },
    enabled: !!productId,
  });

  const activePlaybooks = linkedPlaybooks.filter(lp => lp.playbook?.is_active);
  const inactivePlaybooks = linkedPlaybooks.filter(lp => lp.playbook && !lp.playbook.is_active);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Playbooks Vinculados</span>
        <Badge variant="secondary" className="text-xs">
          {activePlaybooks.length} ativo{activePlaybooks.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : linkedPlaybooks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum playbook vinculado. Vincule produtos dentro do playbook desejado.
        </p>
      ) : (
        <div className="space-y-1">
          {activePlaybooks.map(lp => (
            <div
              key={lp.playbook_id}
              className="flex items-center justify-between text-sm bg-background rounded px-2 py-1.5 cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => navigate(`/playbooks?edit=${lp.playbook_id}`)}
            >
              <span className="text-foreground">{lp.playbook?.name}</span>
              <div className="flex items-center gap-1">
                <Badge variant="default" className="text-[10px]">Ativo</Badge>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          ))}
          {inactivePlaybooks.map(lp => (
            <div
              key={lp.playbook_id}
              className="flex items-center justify-between text-sm bg-background rounded px-2 py-1.5 opacity-60"
            >
              <span className="text-foreground">{lp.playbook?.name}</span>
              <Badge variant="outline" className="text-[10px]">Inativo</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
