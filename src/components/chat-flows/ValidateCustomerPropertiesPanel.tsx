import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

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

      {/* Variáveis de saída */}
      <div className="pt-2 border-t">
        <Label className="text-xs text-muted-foreground">Variáveis de saída</Label>
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px]">É cliente validado?</Label>
            <Input
              value={selectedNode.data.save_validated_as || "customer_validated"}
              onChange={(e) => updateNodeData("save_validated_as", e.target.value)}
              placeholder="customer_validated"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Nome encontrado</Label>
            <Input
              value={selectedNode.data.save_customer_name_as || "customer_name_found"}
              onChange={(e) => updateNodeData("save_customer_name_as", e.target.value)}
              placeholder="customer_name_found"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Email encontrado</Label>
            <Input
              value={selectedNode.data.save_customer_email_as || "customer_email_found"}
              onChange={(e) => updateNodeData("save_customer_email_as", e.target.value)}
              placeholder="customer_email_found"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Preview de variáveis */}
      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">Variáveis disponíveis após execução:</p>
        <div className="space-y-0.5 font-mono text-[10px]">
          <p><span className="text-green-600">{`{{${selectedNode.data.save_validated_as || "customer_validated"}}}`}</span> → true/false</p>
          <p><span className="text-blue-600">{`{{${selectedNode.data.save_customer_name_as || "customer_name_found"}}}`}</span> → Nome do cliente</p>
          <p><span className="text-purple-600">{`{{${selectedNode.data.save_customer_email_as || "customer_email_found"}}}`}</span> → Email do cliente</p>
        </div>
      </div>
    </div>
  );
}
