import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectColumn, useUpdateProjectColumn } from "@/hooks/useProjectColumns";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useToast } from "@/hooks/use-toast";

const columnColors = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#64748b",
];

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  is_final: z.boolean(),
  notify_client_on_enter: z.boolean(),
  email_template_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ColumnSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: ProjectColumn;
  boardId: string;
}

export function ColumnSettingsDialog({ open, onOpenChange, column, boardId }: ColumnSettingsDialogProps) {
  const [selectedColor, setSelectedColor] = useState(column.color);
  const updateColumn = useUpdateProjectColumn();
  const { data: emailTemplates } = useEmailTemplates();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: column.name,
      is_final: column.is_final,
      notify_client_on_enter: column.notify_client_on_enter,
      email_template_id: column.email_template_id || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: column.name,
        is_final: column.is_final,
        notify_client_on_enter: column.notify_client_on_enter,
        email_template_id: column.email_template_id || "",
      });
      setSelectedColor(column.color);
    }
  }, [open, column, form]);

  const notifyEnabled = form.watch("notify_client_on_enter");

  const onSubmit = (data: FormData) => {
    updateColumn.mutate(
      {
        id: column.id,
        board_id: boardId,
        name: data.name,
        color: selectedColor,
        is_final: data.is_final,
        notify_client_on_enter: data.notify_client_on_enter,
        email_template_id: data.notify_client_on_enter ? (data.email_template_id || null) : null,
      },
      {
        onSuccess: () => {
          toast({ title: "Coluna atualizada!" });
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações da Coluna</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {columnColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    selectedColor === color ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_final">Coluna final</Label>
              <p className="text-xs text-muted-foreground">Cards aqui são considerados concluídos</p>
            </div>
            <Switch
              id="is_final"
              checked={form.watch("is_final")}
              onCheckedChange={(checked) => form.setValue("is_final", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notify">Notificar cliente</Label>
              <p className="text-xs text-muted-foreground">Envia email quando card entrar nesta coluna</p>
            </div>
            <Switch
              id="notify"
              checked={notifyEnabled}
              onCheckedChange={(checked) => form.setValue("notify_client_on_enter", checked)}
            />
          </div>

          {notifyEnabled && (
            <div className="space-y-2">
              <Label>Template de Email</Label>
              <Select
                value={form.watch("email_template_id")}
                onValueChange={(value) => form.setValue("email_template_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Template padrão do sistema" />
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
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{{card_title}}"}, {"{{column_name}}"}, {"{{client_name}}"}, {"{{board_name}}"}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateColumn.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
