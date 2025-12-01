import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Package, Users, PlayCircle } from "lucide-react";

interface ReprocessingReportDialogProps {
  data: {
    success: boolean;
    processed: number;
    playbooks_created: number;
    product_name: string;
    contact_ids: string[];
  } | null;
  onClose: () => void;
}

export function ReprocessingReportDialog({ data, onClose }: ReprocessingReportDialogProps) {
  if (!data) return null;

  return (
    <Dialog open={!!data} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            Reprocessamento Concluído
          </DialogTitle>
          <DialogDescription>
            Vendas foram reprocessadas e playbooks iniciados com sucesso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Name */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Package className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Produto</p>
              <p className="font-medium text-foreground">{data.product_name}</p>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-success/10 rounded-lg border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-success" />
                <p className="text-xs text-success">Clientes</p>
              </div>
              <p className="text-2xl font-bold text-success">{data.processed}</p>
              <p className="text-xs text-success/80">
                {data.processed === 1 ? 'processado' : 'processados'}
              </p>
            </div>

            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <PlayCircle className="h-4 w-4 text-primary" />
                <p className="text-xs text-primary">Playbooks</p>
              </div>
              <p className="text-2xl font-bold text-primary">{data.playbooks_created}</p>
              <p className="text-xs text-primary/80">
                {data.playbooks_created === 1 ? 'iniciado' : 'iniciados'}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="p-3 bg-muted/30 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-2">O que foi feito:</p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span className="text-foreground">
                  {data.processed} {data.processed === 1 ? 'cliente recebeu' : 'clientes receberam'} os playbooks de onboarding
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span className="text-foreground">
                  Automações iniciadas automaticamente
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span className="text-foreground">
                  Alertas marcados como resolvidos
                </span>
              </li>
            </ul>
          </div>

          {/* Contact IDs Badge (for debugging) */}
          {data.contact_ids && data.contact_ids.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="mb-1">IDs dos contatos processados:</p>
              <div className="flex flex-wrap gap-1">
                {data.contact_ids.slice(0, 5).map((id) => (
                  <Badge key={id} variant="outline" className="font-mono text-[10px]">
                    {id.slice(0, 8)}...
                  </Badge>
                ))}
                {data.contact_ids.length > 5 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{data.contact_ids.length - 5} mais
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
