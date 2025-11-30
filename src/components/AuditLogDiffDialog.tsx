import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight } from "lucide-react";

interface AuditLogDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldData: any;
  newData: any;
  action: string;
}

export default function AuditLogDiffDialog({ 
  open, 
  onOpenChange, 
  oldData, 
  newData,
  action 
}: AuditLogDiffDialogProps) {
  
  const renderValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getChangedFields = () => {
    if (action === 'DELETE') {
      return Object.keys(oldData || {}).map(key => ({
        field: key,
        oldValue: oldData[key],
        newValue: null,
        type: 'deleted'
      }));
    }
    
    if (action === 'INSERT') {
      return Object.keys(newData || {}).map(key => ({
        field: key,
        oldValue: null,
        newValue: newData[key],
        type: 'created'
      }));
    }
    
    // UPDATE - apenas campos que mudaram
    const changes: any[] = [];
    const allKeys = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {})
    ]);
    
    allKeys.forEach(key => {
      const oldVal = oldData?.[key];
      const newVal = newData?.[key];
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: key,
          oldValue: oldVal,
          newValue: newVal,
          type: 'modified'
        });
      }
    });
    
    return changes;
  };

  const changes = getChangedFields();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Alteração</DialogTitle>
          <DialogDescription>
            {action === 'DELETE' && 'Dados excluídos do registro'}
            {action === 'INSERT' && 'Dados criados no registro'}
            {action === 'UPDATE' && `${changes.length} campos alterados`}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-4">
            {changes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma alteração detectada
              </div>
            ) : (
              changes.map((change, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {change.field}
                    </Badge>
                    {change.type === 'deleted' && (
                      <Badge variant="destructive" className="text-xs">Excluído</Badge>
                    )}
                    {change.type === 'created' && (
                      <Badge className="text-xs bg-green-600">Criado</Badge>
                    )}
                    {change.type === 'modified' && (
                      <Badge variant="default" className="text-xs">Modificado</Badge>
                    )}
                  </div>
                  
                  {change.type === 'deleted' && (
                    <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-200 dark:border-red-900">
                      <div className="text-sm font-medium text-red-900 dark:text-red-100">
                        {renderValue(change.oldValue)}
                      </div>
                    </div>
                  )}
                  
                  {change.type === 'created' && (
                    <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-200 dark:border-green-900">
                      <div className="text-sm font-medium text-green-900 dark:text-green-100">
                        {renderValue(change.newValue)}
                      </div>
                    </div>
                  )}
                  
                  {change.type === 'modified' && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-200 dark:border-red-900">
                        <div className="text-xs text-red-600 dark:text-red-400 mb-1">Antes</div>
                        <div className="text-sm font-medium text-red-900 dark:text-red-100">
                          {renderValue(change.oldValue)}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-200 dark:border-green-900">
                        <div className="text-xs text-green-600 dark:text-green-400 mb-1">Depois</div>
                        <div className="text-sm font-medium text-green-900 dark:text-green-100">
                          {renderValue(change.newValue)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
