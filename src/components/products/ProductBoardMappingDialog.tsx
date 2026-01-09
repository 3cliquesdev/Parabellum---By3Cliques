import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { useProducts } from "@/hooks/useProducts";
import { useProjectBoards } from "@/hooks/useProjectBoards";
import { useProjectColumns } from "@/hooks/useProjectColumns";
import { useForms } from "@/hooks/useForms";
import { useProfiles } from "@/hooks/useProfiles";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import {
  useCreateProductBoardMapping,
  useUpdateProductBoardMapping,
  type ProductBoardMapping,
  type ProductBoardMappingInput,
} from "@/hooks/useProductBoardMappings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapping: ProductBoardMapping | null;
}

export function ProductBoardMappingDialog({ open, onOpenChange, mapping }: Props) {
  const { data: products } = useProducts();
  const { data: boards } = useProjectBoards();
  const { data: forms } = useForms();
  const { data: profiles } = useProfiles();
  const { data: emailTemplates } = useEmailTemplates();

  const createMutation = useCreateProductBoardMapping();
  const updateMutation = useUpdateProductBoardMapping();

  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const { data: columns } = useProjectColumns(selectedBoardId || undefined);

  const { register, handleSubmit, reset, watch, setValue } = useForm<ProductBoardMappingInput>({
    defaultValues: {
      product_id: "",
      board_id: "",
      initial_column_id: "",
      form_filled_column_id: null,
      form_id: null,
      auto_assign_user_id: null,
      send_welcome_email: false,
      email_template_id: null,
      is_active: true,
    },
  });

  const watchBoardId = watch("board_id");
  const watchSendEmail = watch("send_welcome_email");

  useEffect(() => {
    if (watchBoardId && watchBoardId !== selectedBoardId) {
      setSelectedBoardId(watchBoardId);
    }
  }, [watchBoardId, selectedBoardId]);

  useEffect(() => {
    if (mapping) {
      setValue("product_id", mapping.product_id);
      setValue("board_id", mapping.board_id);
      setValue("initial_column_id", mapping.initial_column_id);
      setValue("form_filled_column_id", mapping.form_filled_column_id);
      setValue("form_id", mapping.form_id);
      setValue("auto_assign_user_id", mapping.auto_assign_user_id);
      setValue("send_welcome_email", mapping.send_welcome_email);
      setValue("email_template_id", mapping.email_template_id);
      setValue("is_active", mapping.is_active);
      setSelectedBoardId(mapping.board_id);
    } else {
      reset();
      setSelectedBoardId("");
    }
  }, [mapping, setValue, reset]);

  const onSubmit = (data: ProductBoardMappingInput) => {
    if (mapping) {
      updateMutation.mutate(
        { id: mapping.id, ...data },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createMutation.mutate(data, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mapping ? "Editar Mapeamento" : "Novo Mapeamento Produto → Kanban"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Product */}
          <div className="space-y-2">
            <Label>Produto Kiwify *</Label>
            <Select
              value={watch("product_id")}
              onValueChange={(v) => setValue("product_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Board */}
          <div className="space-y-2">
            <Label>Board de Destino *</Label>
            <Select
              value={watch("board_id")}
              onValueChange={(v) => {
                setValue("board_id", v);
                setValue("initial_column_id", "");
                setValue("form_filled_column_id", null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o board" />
              </SelectTrigger>
              <SelectContent>
                {boards?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Initial Column */}
          {selectedBoardId && (
            <div className="space-y-2">
              <Label>Coluna Inicial (onde card é criado) *</Label>
              <Select
                value={watch("initial_column_id")}
                onValueChange={(v) => setValue("initial_column_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  {columns?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Form */}
          <div className="space-y-2">
            <Label>Formulário a Preencher</Label>
            <Select
              value={watch("form_id") || "none"}
              onValueChange={(v) => setValue("form_id", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum formulário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {forms?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Form Filled Column */}
          {selectedBoardId && watch("form_id") && (
            <div className="space-y-2">
              <Label>Coluna após Preencher Formulário</Label>
              <Select
                value={watch("form_filled_column_id") || "none"}
                onValueChange={(v) =>
                  setValue("form_filled_column_id", v === "none" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Manter na mesma coluna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manter na mesma coluna</SelectItem>
                  {columns?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Responsável Automático</Label>
            <Select
              value={watch("auto_assign_user_id") || "none"}
              onValueChange={(v) =>
                setValue("auto_assign_user_id", v === "none" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem responsável automático" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {profiles?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Send Welcome Email */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Enviar Email de Boas-Vindas</Label>
              <p className="text-sm text-muted-foreground">
                Enviar email com link do formulário ao criar o card
              </p>
            </div>
            <Switch
              checked={watchSendEmail}
              onCheckedChange={(v) => setValue("send_welcome_email", v)}
            />
          </div>

          {/* Email Template */}
          {watchSendEmail && (
            <div className="space-y-2">
              <Label>Template do Email</Label>
              <Select
                value={watch("email_template_id") || "none"}
                onValueChange={(v) =>
                  setValue("email_template_id", v === "none" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Email padrão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Email padrão</SelectItem>
                  {emailTemplates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Is Active */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Mapeamento Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Desative para pausar a criação automática de cards
              </p>
            </div>
            <Switch
              checked={watch("is_active")}
              onCheckedChange={(v) => setValue("is_active", v)}
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : mapping ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
