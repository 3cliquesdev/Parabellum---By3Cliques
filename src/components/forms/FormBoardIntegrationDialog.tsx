import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForms } from "@/hooks/useForms";
import { useProjectBoards } from "@/hooks/useProjectBoards";
import { useProjectColumns } from "@/hooks/useProjectColumns";
import { useProfiles } from "@/hooks/useProfiles";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import {
  useFormBoardIntegration,
  useCreateFormBoardIntegration,
  useUpdateFormBoardIntegration,
} from "@/hooks/useFormBoardIntegrations";

const schema = z.object({
  form_id: z.string().min(1, "Selecione um formulário"),
  board_id: z.string().min(1, "Selecione um board"),
  target_column_id: z.string().optional(),
  auto_assign_user_id: z.string().optional(),
  send_confirmation_email: z.boolean(),
  confirmation_email_template_id: z.string().optional(),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface FormBoardIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
}

export function FormBoardIntegrationDialog({
  open,
  onOpenChange,
  editingId,
}: FormBoardIntegrationDialogProps) {
  const { data: existingIntegration } = useFormBoardIntegration(editingId || undefined);
  const { data: forms } = useForms();
  const { data: boards } = useProjectBoards({ status: "active" });
  const { data: profiles } = useProfiles();
  const { data: emailTemplates } = useEmailTemplates();
  const createIntegration = useCreateFormBoardIntegration();
  const updateIntegration = useUpdateFormBoardIntegration();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      form_id: "",
      board_id: "",
      target_column_id: "",
      auto_assign_user_id: "",
      send_confirmation_email: true,
      confirmation_email_template_id: "",
      is_active: true,
    },
  });

  const selectedBoardId = form.watch("board_id");
  const sendConfirmationEmail = form.watch("send_confirmation_email");
  const { data: columns } = useProjectColumns(selectedBoardId || undefined);

  useEffect(() => {
    if (open && existingIntegration) {
      form.reset({
        form_id: existingIntegration.form_id,
        board_id: existingIntegration.board_id,
        target_column_id: existingIntegration.target_column_id || "",
        auto_assign_user_id: existingIntegration.auto_assign_user_id || "",
        send_confirmation_email: existingIntegration.send_confirmation_email,
        confirmation_email_template_id: existingIntegration.confirmation_email_template_id || "",
        is_active: existingIntegration.is_active,
      });
    } else if (open && !editingId) {
      form.reset({
        form_id: "",
        board_id: "",
        target_column_id: "",
        auto_assign_user_id: "",
        send_confirmation_email: true,
        confirmation_email_template_id: "",
        is_active: true,
      });
    }
  }, [open, existingIntegration, editingId, form]);

  const onSubmit = (data: FormData) => {
    const payload = {
      form_id: data.form_id,
      board_id: data.board_id,
      target_column_id: data.target_column_id || null,
      auto_assign_user_id: data.auto_assign_user_id || null,
      send_confirmation_email: data.send_confirmation_email,
      confirmation_email_template_id: data.confirmation_email_template_id || null,
      is_active: data.is_active,
    };

    if (editingId) {
      updateIntegration.mutate(
        { id: editingId, ...payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createIntegration.mutate(payload, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const isPending = createIntegration.isPending || updateIntegration.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar Integração" : "Nova Integração"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Formulário *</Label>
            <Select
              value={form.watch("form_id")}
              onValueChange={(value) => form.setValue("form_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um formulário" />
              </SelectTrigger>
              <SelectContent>
                {forms?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.form_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.form_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Board de Destino *</Label>
            <Select
              value={form.watch("board_id")}
              onValueChange={(value) => {
                form.setValue("board_id", value);
                form.setValue("target_column_id", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um board" />
              </SelectTrigger>
              <SelectContent>
                {boards?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.board_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.board_id.message}
              </p>
            )}
          </div>

          {selectedBoardId && columns && columns.length > 0 && (
            <div className="space-y-2">
              <Label>Coluna Inicial</Label>
              <Select
                value={form.watch("target_column_id")}
                onValueChange={(value) => form.setValue("target_column_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Primeira coluna (padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Primeira coluna</SelectItem>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Responsável Padrão</Label>
            <Select
              value={form.watch("auto_assign_user_id")}
              onValueChange={(value) => form.setValue("auto_assign_user_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum (atribuir manualmente)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {profiles?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Enviar email de confirmação</Label>
              <p className="text-xs text-muted-foreground">
                Envia email para o cliente quando o card é criado
              </p>
            </div>
            <Switch
              checked={sendConfirmationEmail}
              onCheckedChange={(checked) =>
                form.setValue("send_confirmation_email", checked)
              }
            />
          </div>

          {sendConfirmationEmail && (
            <div className="space-y-2">
              <Label>Template de Email</Label>
              <Select
                value={form.watch("confirmation_email_template_id")}
                onValueChange={(value) =>
                  form.setValue("confirmation_email_template_id", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Template padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Template padrão</SelectItem>
                  {emailTemplates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Integração Ativa</Label>
              <p className="text-xs text-muted-foreground">
                Desative para pausar a criação automática de cards
              </p>
            </div>
            <Switch
              checked={form.watch("is_active")}
              onCheckedChange={(checked) => form.setValue("is_active", checked)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
