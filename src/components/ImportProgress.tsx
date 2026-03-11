import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertTriangle, Users, Link2, UserX, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface ImportProgressProps {
  total: number;
  totalCsvRows?: number;
  processed: number;
  created: number;
  updated: number;
  contactsCreated?: number;
  contactsReused?: number;
  skippedNoTitle?: number;
  vendorNotFound?: Array<{ row: number; title: string; vendor_name: string }>;
  productNotFound?: Array<{ row: number; title: string; product_name: string }>;
  errors: Array<{ row: number; email: string; error: string }>;
}

export function ImportProgress({
  total,
  totalCsvRows: totalCsvRowsProp,
  processed,
  created,
  updated,
  contactsCreated: contactsCreatedProp,
  contactsReused: contactsReusedProp,
  skippedNoTitle: skippedNoTitleProp,
  vendorNotFound: vendorNotFoundProp,
  productNotFound: productNotFoundProp,
  errors,
}: ImportProgressProps) {
  const totalCsvRows = totalCsvRowsProp ?? total;
  const contactsCreated = contactsCreatedProp ?? 0;
  const contactsReused = contactsReusedProp ?? 0;
  const skippedNoTitle = skippedNoTitleProp ?? 0;
  const vendorNotFound = vendorNotFoundProp ?? [];
  const productNotFound = productNotFoundProp ?? [];

  const progress = total > 0 ? (processed / total) * 100 : 0;
  const isComplete = processed === total && total > 0;

  const sumCheck = created + skippedNoTitle + errors.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Relatório da Importação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progress bar during import */}
        {!isComplete && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Processando...</span>
              <span className="font-medium">{processed} / {total}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {isComplete && (
          <>
            {/* Total from file */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total de linhas no arquivo
                </span>
                <span className="text-2xl font-bold text-foreground">{totalCsvRows}</span>
              </div>
            </div>

            {/* Success section */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
                value={created}
                label="Deals criados"
                colorClass="text-emerald-600"
              />
              <StatCard
                icon={<Users className="w-5 h-5 text-primary" />}
                value={contactsCreated}
                label="Contatos criados"
                colorClass="text-primary"
              />
              <StatCard
                icon={<Link2 className="w-5 h-5 text-blue-600" />}
                value={contactsReused}
                label="Contatos reutilizados"
                colorClass="text-blue-600"
              />
            </div>

            {/* Warnings section */}
            {(skippedNoTitle > 0 || vendorNotFound.length > 0 || productNotFound.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Avisos
                </h4>

                {skippedNoTitle > 0 && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <span className="text-sm text-amber-900 dark:text-amber-100">
                      Sem título (ignoradas)
                    </span>
                    <span className="font-semibold text-amber-900 dark:text-amber-100">{skippedNoTitle}</span>
                  </div>
                )}

                {vendorNotFound.length > 0 && (
                  <ExpandableWarning
                    icon={<UserX className="w-4 h-4 text-amber-600" />}
                    label="Vendedor não encontrado"
                    count={vendorNotFound.length}
                  >
                    <div className="space-y-1.5 mt-2">
                      {vendorNotFound.map((v, i) => (
                        <div key={i} className="text-xs p-2 bg-amber-100/50 dark:bg-amber-900/20 rounded">
                          <span className="font-medium">Linha {v.row}:</span> "{v.vendor_name}" — {v.title}
                        </div>
                      ))}
                    </div>
                  </ExpandableWarning>
                )}

                {productNotFound.length > 0 && (
                  <ExpandableWarning
                    icon={<Package className="w-4 h-4 text-amber-600" />}
                    label="Produto não encontrado"
                    count={productNotFound.length}
                  >
                    <div className="space-y-1.5 mt-2">
                      {productNotFound.map((p, i) => (
                        <div key={i} className="text-xs p-2 bg-amber-100/50 dark:bg-amber-900/20 rounded">
                          <span className="font-medium">Linha {p.row}:</span> "{p.product_name}" — {p.title}
                        </div>
                      ))}
                    </div>
                  </ExpandableWarning>
                )}
              </div>
            )}

            {/* Errors section */}
            {errors.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-destructive">
                  <XCircle className="w-4 h-4" />
                  Erros ({errors.length})
                </h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {errors.map((error, index) => (
                      <div key={index} className="text-sm p-2 bg-destructive/10 rounded">
                        <p className="font-medium">Linha {error.row}: {error.email}</p>
                        <p className="text-muted-foreground">{error.error}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Sum verification */}
            <div className="p-3 bg-muted/30 rounded-lg border text-sm text-muted-foreground">
              <span className="font-medium">Conferência:</span>{" "}
              {created} criados + {skippedNoTitle} ignorados + {errors.length} erros = {sumCheck}{" "}
              {sumCheck === totalCsvRows ? (
                <span className="text-emerald-600 font-semibold">✓ Bate com total</span>
              ) : (
                <span className="text-amber-600 font-semibold">
                  (enviados ao servidor: {total})
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, value, label, colorClass }: { icon: React.ReactNode; value: number; label: string; colorClass: string }) {
  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg">
      {icon}
      <div>
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ExpandableWarning({ icon, label, count, children }: { icon: React.ReactNode; label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-amber-900 dark:text-amber-100">{label}</span>
        </div>
        <span className="font-semibold text-amber-900 dark:text-amber-100">{count}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
