import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { useReprocessUnmappedSales } from "@/hooks/useReprocessUnmappedSales";
import { ReactNode } from "react";

interface ReprocessSalesButtonProps {
  kiwifyProductId: string;
  productName: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  onSuccess?: (data: any) => void;
  disabled?: boolean;
  children?: ReactNode;
}

export function ReprocessSalesButton({ 
  kiwifyProductId, 
  productName, 
  variant = "default",
  onSuccess,
  disabled = false,
  children
}: ReprocessSalesButtonProps) {
  const { mutate, isPending } = useReprocessUnmappedSales();

  const handleReprocess = () => {
    mutate(
      { kiwify_product_id: kiwifyProductId },
      {
        onSuccess: (data) => {
          if (onSuccess) {
            onSuccess(data);
          }
        },
      }
    );
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleReprocess}
      disabled={isPending || disabled}
    >
      {isPending ? (
        <>
          <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
          Processando...
        </>
      ) : (
        <>
          {children || (
            <>
              <RefreshCcw className="h-4 w-4 mr-2" />
              🔄 Reprocessar Vendas
            </>
          )}
        </>
      )}
    </Button>
  );
}
