import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Wand2,
  User,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  Key,
  Building2,
  MessageSquare,
  DollarSign,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SmartCollectionSectionProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

const COLLECTION_FIELDS = [
  { key: 'name', label: 'Nome', icon: User },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'phone', label: 'Telefone', icon: Phone },
  { key: 'cpf', label: 'CPF', icon: CreditCard },
  { key: 'address', label: 'Endereço', icon: MapPin },
  { key: 'pix_key', label: 'Chave PIX', icon: Key },
  { key: 'bank', label: 'Banco', icon: Building2 },
  { key: 'reason', label: 'Motivo', icon: MessageSquare },
  { key: 'amount', label: 'Valor', icon: DollarSign },
];

export function SmartCollectionSection({
  selectedNode,
  updateNodeData,
}: SmartCollectionSectionProps) {
  const smartCollectionEnabled = selectedNode.data.smart_collection_enabled === true;
  const selectedFields: string[] = selectedNode.data.smart_collection_fields || ['name', 'email'];
  
  const handleFieldToggle = (field: string) => {
    const current = selectedNode.data.smart_collection_fields || ['name', 'email'];
    const newFields = current.includes(field)
      ? current.filter((f: string) => f !== field)
      : [...current, field];
    updateNodeData("smart_collection_fields", newFields);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-amber-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">
            Pedir Dados do Cliente
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                   A IA pede os dados que faltam do cliente durante a conversa, de forma natural.
                 </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          checked={smartCollectionEnabled}
          onCheckedChange={(checked) => updateNodeData("smart_collection_enabled", checked)}
        />
      </div>

      {smartCollectionEnabled && (
        <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20 space-y-3">
          <p className="text-xs text-muted-foreground">
            A IA pode pedir esses dados se não tiver:
          </p>

          <div className="grid grid-cols-2 gap-2">
            {COLLECTION_FIELDS.map(({ key, label, icon: Icon }) => (
              <label
                key={key}
                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1.5 rounded"
              >
                <Checkbox
                  checked={selectedFields.includes(key)}
                  onCheckedChange={() => handleFieldToggle(key)}
                  className="h-3.5 w-3.5"
                />
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {selectedFields.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] text-muted-foreground mb-1.5">
                Campos selecionados:
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedFields.map((field) => {
                  const fieldInfo = COLLECTION_FIELDS.find(f => f.key === field);
                  return (
                    <Badge
                      key={field}
                      variant="outline"
                      className="text-[10px] px-1.5 bg-amber-500/10 border-amber-500/30"
                    >
                      {fieldInfo?.label || field}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded">
            💡 A IA pede um dado por vez, só se ainda não tiver no cadastro.
          </p>
        </div>
      )}
    </div>
  );
}
