import { useState } from "react";
import { useSalesChannels, useSalesChannelsMutations, SalesChannel } from "@/hooks/useSalesChannels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SalesChannelsSettingsPage() {
  const { data: channels, isLoading } = useSalesChannels(false);
  const { createChannel, updateChannel, deleteChannel } = useSalesChannelsMutations();
  const navigate = useNavigate();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<SalesChannel | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", icon: "💳", requires_order_id: false, description: "", sort_order: 0 });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", icon: "💳", requires_order_id: false, description: "", sort_order: 0 });
    setShowDialog(true);
  };

  const openEdit = (ch: SalesChannel) => {
    setEditing(ch);
    setForm({ name: ch.name, slug: ch.slug, icon: ch.icon, requires_order_id: ch.requires_order_id, description: ch.description || "", sort_order: ch.sort_order || 0 });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.slug.trim()) return;
    if (editing) {
      updateChannel.mutate({ id: editing.id, updates: form }, { onSuccess: () => setShowDialog(false) });
    } else {
      createChannel.mutate(form, { onSuccess: () => setShowDialog(false) });
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Canais de Venda</h1>
          <p className="text-muted-foreground">Gerencie os canais disponíveis para fechamento de deals</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Canais Cadastrados
            </CardTitle>
            <CardDescription>Canais que os vendedores podem selecionar ao fechar uma venda</CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Canal
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ícone</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Exige ID</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels?.map((ch) => (
                  <TableRow key={ch.id}>
                    <TableCell className="text-xl">{ch.icon}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{ch.name}</span>
                        {ch.description && <p className="text-xs text-muted-foreground">{ch.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{ch.slug}</TableCell>
                    <TableCell className="text-muted-foreground">{ch.sort_order}</TableCell>
                    <TableCell>
                      <Switch
                        checked={ch.requires_order_id}
                        onCheckedChange={(v) => updateChannel.mutate({ id: ch.id, updates: { requires_order_id: v } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={ch.is_active}
                        onCheckedChange={(v) => updateChannel.mutate({ id: ch.id, updates: { is_active: v } })}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ch)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteChannel.mutate(ch.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!channels?.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum canal cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Canal" : "Novo Canal de Venda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="text-center text-xl"
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do Canal</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm({
                      ...form,
                      name,
                      slug: !editing ? generateSlug(name) : form.slug,
                    });
                  }}
                  placeholder="Ex: FForder"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Slug (identificador único)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="Ex: fforder"
                className="font-mono"
                disabled={!!editing}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Exige ID da Venda?</Label>
              <Switch
                checked={form.requires_order_id}
                onCheckedChange={(v) => setForm({ ...form, requires_order_id: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.slug.trim() || createChannel.isPending || updateChannel.isPending}
            >
              {(createChannel.isPending || updateChannel.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
