import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FetchOrderPropertiesPanelProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

export function FetchOrderPropertiesPanel({ selectedNode, updateNodeData }: FetchOrderPropertiesPanelProps) {
  return (
    <div className="space-y-4">
      {/* Tipo de busca */}
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo de busca</Label>
        <Select
          value={selectedNode.data.search_type || "auto"}
          onValueChange={(v) => updateNodeData("search_type", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Detectar automaticamente</SelectItem>
            <SelectItem value="tracking">Código de rastreio (BR...)</SelectItem>
            <SelectItem value="order_id">Número do pedido (SA...)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          "Auto" detecta se começa com BR/LP (rastreio) ou outro prefixo (pedido)
        </p>
      </div>

      {/* Variável fonte */}
      <div className="space-y-1.5">
        <Label className="text-xs">Variável de origem</Label>
        <Input
          value={selectedNode.data.source_variable || ""}
          onChange={(e) => updateNodeData("source_variable", e.target.value)}
          placeholder="customer_code"
        />
        <p className="text-[10px] text-muted-foreground">
          Variável coletada anteriormente ou deixe vazio para usar última mensagem
        </p>
      </div>

      {/* Variáveis de saída */}
      <div className="pt-2 border-t">
        <Label className="text-xs text-muted-foreground">Variáveis de saída</Label>
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Pedido encontrado?</Label>
            <Input
              value={selectedNode.data.save_found_as || "order_found"}
              onChange={(e) => updateNodeData("save_found_as", e.target.value)}
              placeholder="order_found"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Status do pedido</Label>
            <Input
              value={selectedNode.data.save_status_as || "order_status"}
              onChange={(e) => updateNodeData("save_status_as", e.target.value)}
              placeholder="order_status"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Horário de embalagem</Label>
            <Input
              value={selectedNode.data.save_packed_at_as || "packed_at_formatted"}
              onChange={(e) => updateNodeData("save_packed_at_as", e.target.value)}
              placeholder="packed_at_formatted"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Preview de variáveis */}
      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">Variáveis disponíveis após execução:</p>
        <div className="space-y-0.5 font-mono text-[10px]">
          <p><span className="text-green-600">{`{{${selectedNode.data.save_found_as || "order_found"}}}`}</span> → true/false</p>
          <p><span className="text-blue-600">{`{{${selectedNode.data.save_status_as || "order_status"}}}`}</span> → PACKED, etc</p>
          <p><span className="text-purple-600">{`{{${selectedNode.data.save_packed_at_as || "packed_at_formatted"}}}`}</span> → "10/12/2025 às 10:17"</p>
          <p><span className="text-amber-600">{`{{order_box_number}}`}</span> → Código original</p>
          <p><span className="text-cyan-600">{`{{order_platform}}`}</span> → Plataforma</p>
        </div>
      </div>
    </div>
  );
}
