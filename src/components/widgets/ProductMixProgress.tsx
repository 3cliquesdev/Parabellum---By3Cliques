import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle2, AlertCircle } from "lucide-react";

interface ProductTarget {
  product_id: string;
  product_name: string;
  target_quantity: number;
  current_quantity: number;
}

interface ProductMixProgressProps {
  productTargets: ProductTarget[];
}

export function ProductMixProgress({ productTargets }: ProductMixProgressProps) {
  if (!productTargets || productTargets.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Mix de Produtos
          </CardTitle>
          <CardDescription>
            Nenhuma sub-meta configurada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Configure sub-metas por produto para acompanhar o mix de vendas
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-primary" />
          Mix de Produtos
        </CardTitle>
        <CardDescription>
          Sub-metas por produto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {productTargets.map((target) => {
            const percentage = target.target_quantity > 0 
              ? Math.min((target.current_quantity / target.target_quantity) * 100, 100)
              : 0;
            const isComplete = target.current_quantity >= target.target_quantity;
            const remaining = Math.max(target.target_quantity - target.current_quantity, 0);

            return (
              <div
                key={target.product_id}
                className={`p-4 rounded-lg border ${
                  isComplete 
                    ? 'bg-green-500/5 border-green-500/20' 
                    : 'bg-muted/50 border-border'
                }`}
              >
                {/* Product Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold text-sm truncate">
                      {target.product_name}
                    </span>
                  </div>
                  {isComplete ? (
                    <Badge className="bg-green-500 flex-shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completo
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex-shrink-0">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {remaining} faltando
                    </Badge>
                  )}
                </div>

                {/* Progress Bar */}
                <Progress value={percentage} className="h-2 mb-2" />

                {/* Stats */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {target.current_quantity} de {target.target_quantity}
                  </span>
                  <span className={`font-semibold ${
                    isComplete ? 'text-green-600' : 'text-foreground'
                  }`}>
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Produtos Completos</p>
              <p className="text-2xl font-bold">
                {productTargets.filter(t => t.current_quantity >= t.target_quantity).length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Produtos</p>
              <p className="text-2xl font-bold">
                {productTargets.length}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}