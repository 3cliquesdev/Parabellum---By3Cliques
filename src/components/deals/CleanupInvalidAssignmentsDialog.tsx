import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export function CleanupInvalidAssignmentsDialog() {
  const [open, setOpen] = useState(false);
  const [invalidCount, setInvalidCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check for invalid assignments on mount
  useEffect(() => {
    checkInvalidAssignments();
  }, []);

  const checkInvalidAssignments = async () => {
    setChecking(true);
    try {
      // Get all sales_rep user IDs
      const { data: salesRepRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales_rep");

      if (rolesError) throw rolesError;

      const salesRepIds = new Set(salesRepRoles?.map(r => r.user_id) || []);

      // Get all deals with assigned_to that is NOT null
      const { data: dealsWithAssignment, error: dealsError } = await supabase
        .from("deals")
        .select("id, assigned_to")
        .not("assigned_to", "is", null);

      if (dealsError) throw dealsError;

      // Count deals where assigned_to is NOT a sales_rep
      const invalidDeals = dealsWithAssignment?.filter(
        d => d.assigned_to && !salesRepIds.has(d.assigned_to)
      ) || [];

      setInvalidCount(invalidDeals.length);
    } catch (error) {
      console.error("Error checking invalid assignments:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleCleanup = async () => {
    setLoading(true);
    try {
      // Get all sales_rep user IDs
      const { data: salesRepRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales_rep");

      if (rolesError) throw rolesError;

      const salesRepIds = new Set(salesRepRoles?.map(r => r.user_id) || []);

      // Get all deals with assigned_to that is NOT null
      const { data: dealsWithAssignment, error: dealsError } = await supabase
        .from("deals")
        .select("id, assigned_to, title")
        .not("assigned_to", "is", null);

      if (dealsError) throw dealsError;

      // Filter deals where assigned_to is NOT a sales_rep
      const invalidDeals = dealsWithAssignment?.filter(
        d => d.assigned_to && !salesRepIds.has(d.assigned_to)
      ) || [];

      if (invalidDeals.length === 0) {
        toast({
          title: "Nenhum negócio para limpar",
          description: "Todos os negócios já estão corretamente atribuídos.",
        });
        setOpen(false);
        return;
      }

      const invalidDealIds = invalidDeals.map(d => d.id);

      // Update all invalid deals to have assigned_to = null
      const { error: updateError } = await supabase
        .from("deals")
        .update({ assigned_to: null, updated_at: new Date().toISOString() })
        .in("id", invalidDealIds);

      if (updateError) throw updateError;

      // Invalidate queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ["deals"] });

      toast({
        title: "Limpeza concluída",
        description: `${invalidDeals.length} negócio(s) tiveram o responsável removido.`,
      });

      setInvalidCount(0);
      setOpen(false);
    } catch (error) {
      console.error("Error cleaning up assignments:", error);
      toast({
        title: "Erro na limpeza",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't show if no invalid assignments
  if (checking || invalidCount === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-destructive text-destructive hover:bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <span>Responsáveis inválidos</span>
          <Badge variant="destructive" className="ml-1">{invalidCount}</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Limpar Responsáveis Inválidos
          </DialogTitle>
          <DialogDescription className="text-left">
            Foram encontrados <strong>{invalidCount}</strong> negócio(s) atribuídos a usuários que
            não são vendedores (sales_rep).
            <br /><br />
            Ao confirmar, esses negócios terão o responsável removido (ficam sem dono).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleCleanup}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Remover {invalidCount} responsável(is)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
