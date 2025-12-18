import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";
import { useCreateProduct, useUpdateProduct } from "@/hooks/useProducts";
import { useDeliveryGroups } from "@/hooks/useDeliveryGroups";
import { useProductOffers, useCreateProductOffer, useDeleteProductOffer } from "@/hooks/useProductOffers";
import { useSupportChannels } from "@/hooks/useSupportChannels";
import { Plus, Trash2, Download } from "lucide-react";
import { ImportKiwifyOffersDialog } from "@/components/products/ImportKiwifyOffersDialog";

const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  external_id: z.string().optional(),
  delivery_group_id: z.string().optional(),
  support_channel_id: z.string().optional(),
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
    support_channel_id: string | null;
    requires_account_manager: boolean;
    is_active: boolean;
    price: number | null;
    delivery_groups?: {
      id: string;
      name: string;
    };
  };
  initialData?: {
    name?: string;
    external_id?: string;
  };
}

export function ProductDialog({ open, onOpenChange, product, initialData }: ProductDialogProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: deliveryGroups } = useDeliveryGroups();
  const { data: supportChannels } = useSupportChannels();
  const { data: offers } = useProductOffers(product?.id || null);
  const createOffer = useCreateProductOffer();
  const deleteOffer = useDeleteProductOffer();
  
  const [newOfferData, setNewOfferData] = useState({
    offer_id: "",
    offer_name: "",
    price: 0,
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || initialData?.name || "",
      description: product?.description || "",
      external_id: product?.external_id || initialData?.external_id || "",
      delivery_group_id: product?.delivery_group_id || "none",
      support_channel_id: product?.support_channel_id || "none",
      requires_account_manager: product?.requires_account_manager || false,
      is_active: product?.is_active ?? true,
    },
  });

  // Reset form when product or initialData changes
  useEffect(() => {
    form.reset({
      name: product?.name || initialData?.name || "",
      description: product?.description || "",
      external_id: product?.external_id || initialData?.external_id || "",
      delivery_group_id: product?.delivery_group_id || "none",
      support_channel_id: product?.support_channel_id || "none",
      requires_account_manager: product?.requires_account_manager || false,
      is_active: product?.is_active ?? true,
    });
  }, [product, initialData, form]);

  const handleAddOffer = async () => {
    if (!product || !newOfferData.offer_id || !newOfferData.offer_name) return;
    
    await createOffer.mutateAsync({
      product_id: product.id,
      offer_id: newOfferData.offer_id,
      offer_name: newOfferData.offer_name,
      price: newOfferData.price,
    });
    
    setNewOfferData({ offer_id: "", offer_name: "", price: 0 });
  };

  const onSubmit = async (data: ProductFormData) => {
    const delivery_group_id = data.delivery_group_id === "none" ? null : data.delivery_group_id;
    const support_channel_id = data.support_channel_id === "none" ? null : data.support_channel_id;

    if (product) {
      await updateProduct.mutateAsync({
        id: product.id,
        updates: {
          name: data.name,
          description: data.description || undefined,
          external_id: data.external_id || undefined,
          delivery_group_id: delivery_group_id || undefined,
          support_channel_id: support_channel_id || undefined,
          requires_account_manager: data.requires_account_manager,
          is_active: data.is_active,
        },
      });

      // FASE 1: Vincular deals ao produto após mapeamento
      if (data.external_id || offers?.length) {
        const kiwifyIds = [
          ...(data.external_id ? [data.external_id] : []),
          ...(offers?.map(o => o.offer_id) || []),
        ];

        try {
          const { data: linkResult } = await supabase.functions.invoke('link-deals-to-product', {
            body: { 
              product_id: product.id,
              kiwify_product_ids: kiwifyIds,
            },
          });

          if (linkResult?.linked_count > 0) {
            toast({
              title: "✅ Deals vinculados",
              description: `${linkResult.linked_count} deal(s) foram vinculados ao produto ${data.name}`,
            });
          }
        } catch (error) {
          console.error('Erro ao vincular deals:', error);
        }
      }
    } else {
      await createProduct.mutateAsync({
        name: data.name,
        description: data.description || undefined,
        external_id: data.external_id || undefined,
        delivery_group_id: delivery_group_id || undefined,
        support_channel_id: support_channel_id || undefined,
        requires_account_manager: data.requires_account_manager,
        is_active: data.is_active,
      });
    }

    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
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
                  <FormLabel className="text-sm font-medium">
                    Nome do Produto <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Mentoria High Ticket" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price Display - Read Only */}
            {product && offers && offers.length > 0 && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Preço (via Kiwify)</p>
                    <p className="text-lg font-bold text-green-600">
                      {(() => {
                        const activeOffers = offers.filter(o => o.is_active);
                        if (activeOffers.length === 0) return "R$ 0,00";
                        const prices = activeOffers.map(o => o.price);
                        const minPrice = Math.min(...prices);
                        const maxPrice = Math.max(...prices);
                        if (minPrice === maxPrice) {
                          return `R$ ${minPrice.toFixed(2).replace('.', ',')}`;
                        }
                        return `R$ ${minPrice.toFixed(2).replace('.', ',')} - R$ ${maxPrice.toFixed(2).replace('.', ',')}`;
                      })()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {offers.length} oferta(s) vinculada(s)
                  </Badge>
                </div>
              </div>
            )}

            {product && (!offers || offers.length === 0) && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Nenhuma oferta Kiwify vinculada. Vincule ofertas abaixo para definir o preço.
                </p>
              </div>
            )}

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

            <div className="grid grid-cols-3 gap-4">
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
                      Cole o product_id da Kiwify
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
                      Automações disparadas na venda
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="support_channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>📡 Canal de Atendimento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um canal (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {supportChannels?.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            <div className="flex items-center gap-2">
                              <span 
                                className="inline-block w-3 h-3 rounded-full" 
                                style={{ backgroundColor: channel.color }}
                              />
                              {channel.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Canal para distribuir atendimento
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requires_account_manager"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        Requer Consultor
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Atribuir consultor pós-onboarding
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">Produto Ativo</FormLabel>
                      <FormDescription className="text-xs">
                        Exibir em novos negócios
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
            </div>

            {/* Seção de Ofertas Kiwify */}
            {product && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Ofertas Vinculadas (Kiwify)</h3>
                    <p className="text-xs text-muted-foreground">Vincule múltiplas ofertas ao mesmo produto</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Importar do Kiwify
                  </Button>
                </div>

                {/* Lista de ofertas existentes */}
                {offers && offers.length > 0 && (
                  <div className="space-y-2">
                    {offers.map((offer) => (
                      <div key={offer.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-900">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              ID: {offer.offer_id}
                            </Badge>
                            <p className="text-sm font-medium">{offer.offer_name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            R$ {offer.price.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteOffer.mutate(offer.id)}
                          disabled={deleteOffer.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulário para adicionar nova oferta */}
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Offer ID (Kiwify)"
                    value={newOfferData.offer_id}
                    onChange={(e) => setNewOfferData({ ...newOfferData, offer_id: e.target.value })}
                  />
                  <Input
                    placeholder="Nome da Oferta"
                    value={newOfferData.offer_name}
                    onChange={(e) => setNewOfferData({ ...newOfferData, offer_name: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Preço"
                    value={newOfferData.price}
                    onChange={(e) => setNewOfferData({ ...newOfferData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOffer}
                  disabled={!newOfferData.offer_id || !newOfferData.offer_name || createOffer.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Oferta
                </Button>
              </div>
            )}

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

        {/* Import Dialog */}
        {product && (
          <ImportKiwifyOffersDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            productId={product.id}
            productName={product.name}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
