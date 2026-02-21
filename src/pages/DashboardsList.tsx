import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Plus, Trash2, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardsList, useCreateDashboard, useDeleteDashboard } from "@/hooks/useDashboards";
import { format } from "date-fns";

export default function DashboardsList() {
  const { data: dashboards, isLoading } = useDashboardsList();
  const createDashboard = useCreateDashboard();
  const deleteDashboard = useDeleteDashboard();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    createDashboard.mutate({ name: name.trim(), description: description.trim() || undefined }, {
      onSuccess: () => {
        setDialogOpen(false);
        setName("");
        setDescription("");
      },
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6 bg-slate-50/50 dark:bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shadow-sm">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboards</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus painéis dinâmicos</p>
            <Link to="/analytics" className="text-xs text-primary hover:underline">← Voltar ao Hub</Link>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Dashboard</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Dashboard</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="dash-name">Nome</Label>
                <Input id="dash-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vendas Mensal" />
              </div>
              <div>
                <Label htmlFor="dash-desc">Descrição (opcional)</Label>
                <Textarea id="dash-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o objetivo..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!name.trim() || createDashboard.isPending}>
                {createDashboard.isPending ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : !dashboards?.length ? (
        <Card className="p-12 text-center">
          <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Nenhum dashboard criado ainda.</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Dashboard" para começar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(d => (
            <Card key={d.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate">{d.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/dashboard/${d.id}`}><ExternalLink className="h-4 w-4" /></Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteDashboard.mutate(d.id)}
                      disabled={deleteDashboard.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {d.description && <CardDescription className="mb-2 line-clamp-2">{d.description}</CardDescription>}
                <p className="text-xs text-muted-foreground">
                  Criado em {format(new Date(d.created_at), "dd/MM/yyyy")}
                </p>
                <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                  <Link to={`/dashboard/${d.id}`}>Abrir Dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
