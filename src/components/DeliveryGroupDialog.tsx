import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { useCreateDeliveryGroup, useUpdateDeliveryGroup } from "@/hooks/useDeliveryGroups";

const deliveryGroupSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  is_active: z.boolean(),
  playbook_ids: z.array(z.string()).min(1, "Selecione ao menos um playbook"),
});

type DeliveryGroupFormData = z.infer<typeof deliveryGroupSchema>;

interface DeliveryGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: any;
}

export function DeliveryGroupDialog({
  open,
  onOpenChange,
  group,
}: DeliveryGroupDialogProps) {
  const { data: playbooks } = usePlaybooks();
  const createGroup = useCreateDeliveryGroup();
  const updateGroup = useUpdateDeliveryGroup();

  const form = useForm<DeliveryGroupFormData>({
    resolver: zodResolver(deliveryGroupSchema),
    defaultValues: {
      name: group?.name || "",
      description: group?.description || "",
      is_active: group?.is_active ?? true,
      playbook_ids: group?.group_playbooks?.map((gp: any) => gp.playbook_id) || [],
    },
  });

  useEffect(() => {
    form.reset({
      name: group?.name || "",
      description: group?.description || "",
      is_active: group?.is_active ?? true,
      playbook_ids: group?.group_playbooks?.map((gp: any) => gp.playbook_id) || [],
    });
  }, [group, form]);

  const onSubmit = async (data: DeliveryGroupFormData) => {
    if (group) {
      await updateGroup.mutateAsync({
        id: group.id,
        name: data.name,
        description: data.description,
        is_active: data.is_active,
        playbook_ids: data.playbook_ids,
      });
    } else {
      await createGroup.mutateAsync({
        name: data.name,
        description: data.description,
        is_active: data.is_active,
        playbook_ids: data.playbook_ids,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {group ? "Editar Grupo de Entrega" : "Novo Grupo de Entrega"}
          </DialogTitle>
          <DialogDescription>
            Configure um pacote de automações que pode ser vinculado a múltiplos produtos
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Grupo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Mentoria Elite" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o que este grupo entrega..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="playbook_ids"
              render={() => (
                <FormItem>
                  <FormLabel>Playbooks do Grupo</FormLabel>
                  <FormDescription>
                    Selecione quais automações serão disparadas quando este grupo for ativado
                  </FormDescription>
                  <div className="space-y-2 mt-2 border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {playbooks?.filter(p => p.is_active).map((playbook) => (
                      <FormField
                        key={playbook.id}
                        control={form.control}
                        name="playbook_ids"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(playbook.id)}
                                onCheckedChange={(checked) => {
                                  const value = field.value || [];
                                  if (checked) {
                                    field.onChange([...value, playbook.id]);
                                  } else {
                                    field.onChange(
                                      value.filter((id) => id !== playbook.id)
                                    );
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {playbook.name}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Grupo Ativo</FormLabel>
                    <FormDescription>
                      Grupos inativos não disparam automações
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createGroup.isPending || updateGroup.isPending}
              >
                {group ? "Atualizar" : "Criar"} Grupo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
