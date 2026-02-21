import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { LayoutDashboard, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardBlocks, useRemoveBlock } from "@/hooks/useDashboards";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddBlockDialog } from "@/components/dashboard-builder/AddBlockDialog";
import { DashboardBlockCard } from "@/components/dashboard-builder/DashboardBlockCard";
import { DashboardBlockTable } from "@/components/dashboard-builder/DashboardBlockTable";
import type { Database } from "@/integrations/supabase/types";

type Dashboard = Database['public']['Tables']['dashboards']['Row'];

export default function DashboardView() {
  const { id } = useParams<{ id: string }>();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Dashboard;
    },
  });

  const { data: blocks, isLoading: blocksLoading } = useDashboardBlocks(id);
  const removeBlock = useRemoveBlock();

  if (dashLoading || blocksLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p className="text-muted-foreground">Dashboard não encontrado.</p>
        <Button variant="link" asChild><Link to="/dashboards">Voltar</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 bg-slate-50/50 dark:bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboards"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground">{dashboard.description}</p>
            )}
          </div>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar Bloco
        </Button>
      </div>

      {/* Blocks Grid */}
      {!blocks?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutDashboard className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhum bloco adicionado.</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Adicionar Bloco" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {blocks.map((block) =>
            block.visualization_type === "card" ? (
              <DashboardBlockCard
                key={block.id}
                block={block}
                onRemove={() => removeBlock.mutate({ id: block.id, dashboard_id: block.dashboard_id })}
              />
            ) : (
              <DashboardBlockTable
                key={block.id}
                block={block}
                onRemove={() => removeBlock.mutate({ id: block.id, dashboard_id: block.dashboard_id })}
              />
            )
          )}
        </div>
      )}

      <AddBlockDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        dashboardId={id!}
        currentBlockCount={blocks?.length ?? 0}
      />
    </div>
  );
}
