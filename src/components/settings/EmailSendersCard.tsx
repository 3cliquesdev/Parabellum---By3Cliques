import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import {
  useEmailSenders,
  useCreateEmailSender,
  useUpdateEmailSender,
  useDeleteEmailSender,
  EmailSender,
} from "@/hooks/useEmailSenders";
import { useDepartments } from "@/hooks/useDepartments";
import { Skeleton } from "@/components/ui/skeleton";

interface SenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sender?: EmailSender;
}

function SenderDialog({ open, onOpenChange, sender }: SenderDialogProps) {
  const { data: departments } = useDepartments();
  const createMutation = useCreateEmailSender();
  const updateMutation = useUpdateEmailSender();
  
  const [formData, setFormData] = useState({
    name: "",
    from_name: "",
    from_email: "",
    department_id: null as string | null,
    is_default: false,
  });

  // Sincroniza formData quando sender ou open mudar
  useEffect(() => {
    if (open) {
      setFormData({
        name: sender?.name || "",
        from_name: sender?.from_name || "",
        from_email: sender?.from_email || "",
        department_id: sender?.department_id || null,
        is_default: sender?.is_default || false,
      });
    }
  }, [sender, open]);

  const handleSubmit = async () => {
    try {
      if (sender) {
        await updateMutation.mutateAsync({ id: sender.id, updates: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving sender:", error);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{sender ? "Editar Remetente" : "Novo Remetente"}</DialogTitle>
          <DialogDescription>
            Configure o endereço de envio de emails
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome Identificador</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Suporte, Comercial, Sistema"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="from_name">Nome de Exibição</Label>
            <Input
              id="from_name"
              value={formData.from_name}
              onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
              placeholder="Ex: Suporte"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="from_email">Email de Envio</Label>
            <Input
              id="from_email"
              type="email"
              value={formData.from_email}
              onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
              placeholder="Ex: contato@mail.3cliques.net"
            />
          </div>

          <div className="grid gap-2">
            <Label>Departamento (opcional)</Label>
            <Select
              value={formData.department_id || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, department_id: value === "none" ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (padrão geral)</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vincule a um departamento para usar automaticamente em emails desse setor
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
            />
            <Label htmlFor="is_default">Remetente Padrão</Label>
          </div>

          {/* Preview */}
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="text-muted-foreground mb-1">Preview:</p>
            <p className="font-mono">
              {formData.from_name || "Nome"} &lt;{formData.from_email || "email@dominio.com"}&gt;
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.name || !formData.from_name || !formData.from_email}
          >
            {isLoading ? "Salvando..." : sender ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailSendersCard() {
  const { data: senders, isLoading } = useEmailSenders();
  const deleteMutation = useDeleteEmailSender();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSender, setSelectedSender] = useState<EmailSender | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (sender: EmailSender) => {
    setSelectedSender(sender);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedSender(undefined);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Remetentes de Email
            </CardTitle>
            <CardDescription>
              Configure os endereços de envio por departamento
            </CardDescription>
          </div>
          <Button onClick={handleCreate} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Remetente
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {senders?.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              Nenhum remetente configurado
            </p>
          )}
          
          {senders?.map((sender) => (
            <div
              key={sender.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">{sender.name}</h4>
                  <p className="text-sm text-muted-foreground font-mono">
                    {sender.from_name} &lt;{sender.from_email}&gt;
                  </p>
                  <div className="flex gap-2 mt-1">
                    {sender.is_default && (
                      <Badge variant="secondary">Padrão</Badge>
                    )}
                    {sender.departments && (
                      <Badge variant="outline" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        {sender.departments.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(sender)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(sender.id)}
                  disabled={sender.is_default}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <SenderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sender={selectedSender}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir remetente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
