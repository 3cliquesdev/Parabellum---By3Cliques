import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReadOnlyVariableBadge } from "./ReadOnlyVariableBadge";

interface ValidateCustomerPropertiesPanelProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

export function ValidateCustomerPropertiesPanel({ selectedNode, updateNodeData }: ValidateCustomerPropertiesPanelProps) {
  return (
    <div className="space-y-4">
      {/* Campos a validar */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold">Campos a validar</Label>
        <p className="text-[10px] text-muted-foreground">
          Selecione quais dados do contato serão verificados na base Kiwify
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between py-1">
            <Label className="text-xs">📱 Telefone</Label>
            <Switch
              checked={selectedNode.data.validate_phone !== false}
              onCheckedChange={(v) => updateNodeData("validate_phone", v)}
            />
          </div>
          <div className="flex items-center justify-between py-1">
            <Label className="text-xs">📧 Email</Label>
            <Switch
              checked={selectedNode.data.validate_email !== false}
              onCheckedChange={(v) => updateNodeData("validate_email", v)}
            />
          </div>
          <div className="flex items-center justify-between py-1">
            <Label className="text-xs">🪪 CPF</Label>
            <Switch
              checked={selectedNode.data.validate_cpf === true}
              onCheckedChange={(v) => updateNodeData("validate_cpf", v)}
            />
          </div>
        </div>
      </div>

      {/* Variáveis de saída - READ ONLY */}
      <div className="pt-2 border-t space-y-2">
        <Label className="text-xs font-semibold">Variáveis geradas automaticamente</Label>
        <p className="text-[10px] text-muted-foreground">
          Clique para copiar e usar em nós seguintes
        </p>
        <div className="space-y-1.5">
          <ReadOnlyVariableBadge variable="customer_validated" description="true/false — Cliente encontrado?" colorClass="text-green-600" />
          <ReadOnlyVariableBadge variable="customer_name_found" description="Nome do cliente na base" colorClass="text-blue-600" />
          <ReadOnlyVariableBadge variable="customer_email_found" description="Email do cliente na base" colorClass="text-purple-600" />
        </div>
      </div>
    </div>
  );
}
