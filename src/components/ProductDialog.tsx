import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useCreateProduct, useUpdateProduct } from "@/hooks/useProducts";
import { useDeliveryGroups } from "@/hooks/useDeliveryGroups";

const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  external_id: z.string().optional(),
  delivery_group_id: z.string().optional(),
  requires_account_manager: z.boolean(),
  is_active: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: {
    id: string;
    name: string;
    description: string | null;
    external_id: string | null;
    delivery_group_id: string | null;
    requires_account_manager: boolean;
    is_active: boolean;
    delivery_groups?: {
      id: string;
      name: string;
    };
  };
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: deliveryGroups } = useDeliveryGroups();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      external_id: product?.external_id || "",
      delivery_group_id: product?.delivery_group_id || "none",
      requires_account_manager: product?.requires_account_manager || false,
      is_active: product?.is_active ?? true,
    },
  });

  // Reset form when product changes
  useEffect(() => {
    form.reset({
      name: product?.name || "",
      description: product?.description || "",
      external_id: product?.external_id || "",
      delivery_group_id: product?.delivery_group_id || "none",
      requires_account_manager: product?.requires_account_manager || false,
      is_active: product?.is_active ?? true,
    });
  }, [product, form]);

  const onSubmit = async (data: ProductFormData) => {
    const delivery_group_id = data.delivery_group_id === "none" ? null : data.delivery_group_id;

    if (product) {
      await updateProduct.mutateAsync({
        id: product.id,
        updates: {
          name: data.name,
          description: data.description || undefined,
          external_id: data.external_id || undefined,
          delivery_group_id: delivery_group_id || undefined,
          requires_account_manager: data.requires_account_manager,
          is_active: data.is_active,
        },
      });
    } else {
      await createProduct.mutateAsync({
        name: data.name,
        description: data.description || undefined,
        external_id: data.external_id || undefined,
        delivery_group_id: delivery_group_id || undefined,
        requires_account_manager: data.requires_account_manager,
        is_active: data.is_active,
      });
    }

    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Mentoria High Ticket" {...field} />
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o produto..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="external_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID Externo (Kiwify)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Kyw8921abc"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Cole o product_id da Kiwify para mapping automático no webhook
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delivery_group_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupo de Entrega</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um grupo (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {deliveryGroups?.filter(g => g.is_active).map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} ({group.group_playbooks?.length || 0} playbooks)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Conjunto de automações disparado quando este produto for vendido
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requires_account_manager"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Requer Consultor de Sucesso
                    </FormLabel>
                    <FormDescription>
                      Após o onboarding, este produto será atribuído a um consultor
                      para acompanhamento contínuo?
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

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Produto Ativo</FormLabel>
                    <FormDescription>
                      Produtos inativos não aparecem no formulário de negócios
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

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createProduct.isPending || updateProduct.isPending}
              >
                {product ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
