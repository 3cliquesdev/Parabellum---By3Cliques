import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { supabase } from "@/integrations/supabase/client";

const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  external_id: z.string().optional(),
  playbook_id: z.string().optional(),
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
    requires_account_manager: boolean;
    is_active: boolean;
    playbook?: Array<{
      id: string;
      name: string;
      is_active: boolean;
    }>;
  };
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: playbooks } = usePlaybooks();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      external_id: product?.external_id || "",
      playbook_id: product?.playbook?.[0]?.id || "",
      requires_account_manager: product?.requires_account_manager || false,
      is_active: product?.is_active ?? true,
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    if (product) {
      await updateProduct.mutateAsync({
        id: product.id,
        updates: {
          name: data.name,
          description: data.description || undefined,
          external_id: data.external_id || undefined,
          requires_account_manager: data.requires_account_manager,
          is_active: data.is_active,
        },
      });
    } else {
      await createProduct.mutateAsync({
        name: data.name,
        description: data.description || undefined,
        external_id: data.external_id || undefined,
        requires_account_manager: data.requires_account_manager,
        is_active: data.is_active,
      });
    }

    // Update playbook link if changed
    if (data.playbook_id && product) {
      await supabase
        .from("onboarding_playbooks")
        .update({ product_id: product.id })
        .eq("id", data.playbook_id);
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
              name="playbook_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Playbook de Onboarding</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um playbook (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {playbooks?.filter(p => p.is_active).map((playbook) => (
                        <SelectItem key={playbook.id} value={playbook.id}>
                          {playbook.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Playbook automático disparado quando este produto for vendido
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
