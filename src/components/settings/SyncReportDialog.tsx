import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Users, Key, Briefcase, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface SyncReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: {
    total_sales: number;
    contacts_created: number;
    contacts_updated: number;
    auth_users_created: number;
    deals_created: number;
    deals_updated: number;
    customers_churned?: number;
    tags_added?: number;
    errors: number;
  };
}

export default function SyncReportDialog({
  open,
  onOpenChange,
  stats,
}: SyncReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <DialogTitle className="text-xl">✅ Sincronização Concluída!</DialogTitle>
              <DialogDescription>
                Histórico de vendas importado com sucesso
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Total */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                📊 Total de vendas processadas
              </span>
              <span className="text-2xl font-bold text-primary">
                {stats.total_sales}
              </span>
            </div>
          </div>

          <Separator />

          {/* Stats Grid */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">Contatos criados</span>
              </div>
              <span className="font-semibold text-foreground">{stats.contacts_created}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Contatos atualizados</span>
              </div>
              <span className="font-semibold text-foreground">{stats.contacts_updated}</span>
            </div>

            {stats.auth_users_created > 0 && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-900 dark:text-emerald-100">
                    Acessos criados
                  </span>
                </div>
                <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {stats.auth_users_created}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">Deals criados</span>
              </div>
              <span className="font-semibold text-foreground">{stats.deals_created}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Deals atualizados</span>
              </div>
              <span className="font-semibold text-foreground">{stats.deals_updated}</span>
            </div>

            {(stats.customers_churned ?? 0) > 0 && (
              <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-900">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span className="text-sm text-rose-900 dark:text-rose-100">
                    Clientes inadimplentes
                  </span>
                </div>
                <span className="font-semibold text-rose-900 dark:text-rose-100">
                  {stats.customers_churned}
                </span>
              </div>
            )}

            {(stats.tags_added ?? 0) > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-900 dark:text-amber-100">
                    Tags "Inadimplente" adicionadas
                  </span>
                </div>
                <span className="font-semibold text-amber-900 dark:text-amber-100">
                  {stats.tags_added}
                </span>
              </div>
            )}
          </div>

          {/* Errors */}
          {stats.errors > 0 && (
            <>
              <Separator />
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    ⚠️ {stats.errors} erro(s) durante processamento
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                    Algumas vendas não puderam ser processadas. Verifique os logs
                    para mais detalhes.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}