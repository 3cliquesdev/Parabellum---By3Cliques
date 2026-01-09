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
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useUpdateProduct } from "@/hooks/useProducts";
import { useDeliveryGroups } from "@/hooks/useDeliveryGroups";
import { useProductOffers } from "@/hooks/useProductOffers";
import { Package, DollarSign, ArrowRightLeft } from "lucide-react";
import { MoveOfferDialog } from "@/components/products/MoveOfferDialog";

const productSchema = z.object({
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
  const updateProduct = useUpdateProduct();
  const { data: deliveryGroups } = useDeliveryGroups();
  const { data: offers } = useProductOffers(product?.id || null);

  // State for move offer dialog
  const [moveOfferDialogOpen, setMoveOfferDialogOpen] = useState(false);
  const [offerToMove, setOfferToMove] = useState<{
    id: string;
    offer_id: string;
    offer_name: string;
    price: number;
  } | null>(null);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      delivery_group_id: product?.delivery_group_id || "none",
      requires_account_manager: product?.requires_account_manager || false,
      is_active: product?.is_active ?? true,
    },
  });

  // Reset form when product changes
  useEffect(() => {
    form.reset({
      delivery_group_id: product?.delivery_group_id || "none",
      requires_account_manager: product?.requires_account_manager || false,
      is_active: product?.is_active ?? true,
    });
  }, [product, form]);

  const [isCreating, setIsCreating] = useState(false);

  const onSubmit = async (data: ProductFormData) => {
    const delivery_group_id = data.delivery_group_id === "none" ? null : data.delivery_group_id;
    let targetProductId: string;
    let targetExternalId: string | null;

    // Se produto não existe, criar primeiro
    if (!product && initialData?.external_id) {
      setIsCreating(true);
      try {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert({
            name: initialData.name || 'Produto Kiwify',
            external_id: initialData.external_id,
            is_active: data.is_active,
            requires_account_manager: data.requires_account_manager,
            delivery_group_id: delivery_group_id,
          })
          .select()
          .single();

        if (error) {
          toast({
            title: "Erro ao criar produto",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        targetProductId = newProduct.id;
        targetExternalId = newProduct.external_id;
        
        toast({
          title: "✅ Produto mapeado",
          description: `${initialData.name} foi criado com sucesso`,
        });
      } finally {
        setIsCreating(false);
      }
    } else if (product) {
      // Atualizar produto existente
      await updateProduct.mutateAsync({
        id: product.id,
        updates: {
          delivery_group_id: delivery_group_id || undefined,
          requires_account_manager: data.requires_account_manager,
          is_active: data.is_active,
        },
      });

      targetProductId = product.id;
      targetExternalId = product.external_id;
    } else {
      return; // Nenhum dado válido
    }

    // Vincular deals ao produto após mapeamento
    if (targetExternalId || offers?.length) {
      const kiwifyIds = [
        ...(targetExternalId ? [targetExternalId] : []),
        ...(offers?.map(o => o.offer_id) || []),
      ];

      try {
        const { data: linkResult } = await supabase.functions.invoke('link-deals-to-product', {
          body: { 
            product_id: targetProductId,
            kiwify_product_ids: kiwifyIds,
          },
        });

        if (linkResult?.linked_count > 0) {
          toast({
            title: "✅ Deals vinculados",
            description: `${linkResult.linked_count} deal(s) foram vinculados ao produto`,
          });
        }
      } catch (error) {
        console.error('Erro ao vincular deals:', error);
      }
    }

    onOpenChange(false);
    form.reset();
  };

  // Display name from product or initialData
  const displayName = product?.name || initialData?.name || "Produto";
  const displayId = product?.external_id || initialData?.external_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {product ? "Configurar Produto" : "Cadastrar Produto Kiwify"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {product 
              ? "Configure grupo de entrega e opções do produto já cadastrado."
              : "Cadastre este produto Kiwify no sistema para vincular deals e automações."}
          </p>
        </DialogHeader>

        {/* Product Info - Read Only */}
        <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{displayName}</h3>
              {displayId && (
                <p className="text-xs text-muted-foreground font-mono">
                  ID: {displayId}
                </p>
              )}
            </div>
          </div>

          {/* Offers Display */}
          {offers && offers.length > 0 && (
            <div className="pt-3 border-t">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Ofertas Vinculadas ({offers.length})</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {offers.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between text-sm bg-background rounded px-2 py-1.5">
                    <span className="text-foreground truncate flex-1">{offer.offer_name}</span>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        R$ {offer.price.toFixed(2).replace('.', ',')}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setOfferToMove(offer);
                          setMoveOfferDialogOpen(true);
                        }}
                        title="Mover para outro produto"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!offers || offers.length === 0) && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                ℹ️ Nenhuma oferta adicional vinculada
              </p>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Delivery Group (Playbook) */}
            <FormField
              control={form.control}
              name="delivery_group_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    📋 Grupo de Entrega (Playbook)
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um grupo" />
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
                  <FormDescription className="text-xs">
                    Automações disparadas automaticamente na venda
                  </FormDescription>
                </FormItem>
              )}
            />

            {/* Switches */}
            <div className="grid grid-cols-2 gap-3">
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
                        Atribuir pós-onboarding
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
                        Exibir em negócios
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

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateProduct.isPending || isCreating || (!product?.external_id && !initialData?.external_id)}>
                {(updateProduct.isPending || isCreating) ? "Salvando..." : (product ? "Salvar" : "Cadastrar")}
              </Button>
            </div>
          </form>
        </Form>

        {/* Move Offer Dialog */}
        <MoveOfferDialog
          open={moveOfferDialogOpen}
          onOpenChange={setMoveOfferDialogOpen}
          offer={offerToMove}
          currentProductId={product?.id || ""}
          currentProductName={displayName}
        />
      </DialogContent>
    </Dialog>
  );
}
