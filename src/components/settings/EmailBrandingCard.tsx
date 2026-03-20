import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Palette, Plus, Pencil, Trash2, Eye, Image } from "lucide-react";
import {
  useEmailBrandings,
  useCreateEmailBranding,
  useUpdateEmailBranding,
  useDeleteEmailBranding,
  EmailBranding,
} from "@/hooks/useEmailBranding";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUploader } from "@/components/ImageUploader";

interface BrandingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branding?: EmailBranding;
}

function BrandingDialog({ open, onOpenChange, branding }: BrandingDialogProps) {
  const createMutation = useCreateEmailBranding();
  const updateMutation = useUpdateEmailBranding();
  
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    header_color: "#1e3a5f",
    primary_color: "#2563eb",
    footer_text: "",
    footer_logo_url: "",
    is_default_customer: false,
    is_default_employee: false,
  });

  // Reset form when branding changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: branding?.name || "",
        logo_url: branding?.logo_url || "",
        header_color: branding?.header_color || "#1e3a5f",
        primary_color: branding?.primary_color || "#2563eb",
        footer_text: branding?.footer_text || "",
        footer_logo_url: branding?.footer_logo_url || "",
        is_default_customer: branding?.is_default_customer || false,
        is_default_employee: branding?.is_default_employee || false,
      });
    }
  }, [open, branding]);

  const handleSubmit = async () => {
    try {
      if (branding) {
        await updateMutation.mutateAsync({ id: branding.id, updates: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving branding:", error);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{branding ? "Editar Branding" : "Novo Branding"}</DialogTitle>
          <DialogDescription>
            Configure a identidade visual dos emails
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome do Branding</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Seu Armazém Drop"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="header_color">Cor do Header</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  id="header_color"
                  value={formData.header_color}
                  onChange={(e) => setFormData({ ...formData, header_color: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.header_color}
                  onChange={(e) => setFormData({ ...formData, header_color: e.target.value })}
                  placeholder="#1e3a5f"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="primary_color">Cor Primária (Botões)</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  id="primary_color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  placeholder="#2563eb"
                />
              </div>
            </div>
          </div>

          <ImageUploader
            label="Logo (Header) — Apenas PNG ou JPEG"
            value={formData.logo_url}
            onChange={(url) => setFormData({ ...formData, logo_url: url || "" })}
            folder="email-branding/logos"
            accept="image/png,image/jpeg"
          />

          <ImageUploader
            label="Logo (Footer)"
            value={formData.footer_logo_url}
            onChange={(url) => setFormData({ ...formData, footer_logo_url: url || "" })}
            folder="email-branding/footer-logos"
          />

          <div className="grid gap-2">
            <Label htmlFor="footer_text">Texto do Rodapé</Label>
            <Textarea
              id="footer_text"
              value={formData.footer_text || ""}
              onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
              placeholder="Seu Armazém Drop - Equipe de Suporte"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="is_default_customer"
                checked={formData.is_default_customer}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default_customer: checked })}
              />
              <Label htmlFor="is_default_customer">Padrão para Clientes</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_default_employee"
                checked={formData.is_default_employee}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default_employee: checked })}
              />
              <Label htmlFor="is_default_employee">Padrão para Funcionários</Label>
            </div>
          </div>

          {/* Preview */}
          <div className="border rounded-lg overflow-hidden mt-4">
            <div className="text-sm text-muted-foreground p-2 bg-muted flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </div>
            <div
              style={{ backgroundColor: formData.header_color }}
              className="p-4 text-center text-white"
            >
              {formData.logo_url ? (
                <img src={formData.logo_url} alt="Logo" className="h-8 mx-auto" />
              ) : (
                <h2 className="text-xl font-bold">{formData.name || "Nome do Branding"}</h2>
              )}
            </div>
            <div className="p-4 bg-white text-gray-800">
              <p>Conteúdo do email aqui...</p>
              <button
                style={{ backgroundColor: formData.primary_color }}
                className="mt-4 px-4 py-2 text-white rounded"
              >
                Botão de Ação
              </button>
            </div>
            <div
              style={{ backgroundColor: formData.header_color }}
              className="p-4 text-center text-white/80 text-sm"
            >
              {formData.footer_text || "Texto do rodapé"}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !formData.name}>
            {isLoading ? "Salvando..." : branding ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailBrandingCard() {
  const { data: brandings, isLoading } = useEmailBrandings();
  const deleteMutation = useDeleteEmailBranding();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBranding, setSelectedBranding] = useState<EmailBranding | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (branding: EmailBranding) => {
    setSelectedBranding(branding);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedBranding(undefined);
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
              <Palette className="h-5 w-5" />
              Branding de Email
            </CardTitle>
            <CardDescription>
              Configure a identidade visual dos emails enviados
            </CardDescription>
          </div>
          <Button onClick={handleCreate} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Branding
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {brandings?.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              Nenhum branding configurado
            </p>
          )}
          
          {brandings?.map((branding) => (
            <div
              key={branding.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: branding.header_color }}
                >
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt={branding.name} className="h-8 w-8 object-contain" />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {branding.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-medium">{branding.name}</h4>
                  <div className="flex gap-2 mt-1">
                    {branding.is_default_customer && (
                      <Badge variant="secondary">Cliente</Badge>
                    )}
                    {branding.is_default_employee && (
                      <Badge variant="outline">Funcionário</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(branding)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(branding.id)}
                  disabled={branding.is_default_customer || branding.is_default_employee}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <BrandingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branding={selectedBranding}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir branding?</AlertDialogTitle>
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
