import { Node, Edge } from "reactflow";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReadOnlyVariableBadge } from "./ReadOnlyVariableBadge";
import { getAncestorNodeIds } from "./variableCatalog";

interface FetchOrderPropertiesPanelProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
  nodes?: Node[];
  edges?: Edge[];
}

export function FetchOrderPropertiesPanel({ selectedNode, updateNodeData, nodes = [], edges = [] }: FetchOrderPropertiesPanelProps) {
  // Collect ancestor variables for source_variable dropdown
  const ancestorIds = getAncestorNodeIds(selectedNode.id, edges);
  const ancestorVariables = nodes
    .filter((n) => ancestorIds.has(n.id) && n.data?.save_as)
    .map((n) => ({
      value: n.data.save_as as string,
      label: `${n.data.save_as} (${n.data.label || n.type})`,
    }))
    .filter((v, i, arr) => arr.findIndex((x) => x.value === v.value) === i);

  const currentSource = selectedNode.data.source_variable || "";
  const isCustomSource = currentSource && !ancestorVariables.some(v => v.value === currentSource) && currentSource !== "__last_message__";

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
            <SelectItem value="auto">🔍 Detectar automaticamente</SelectItem>
            <SelectItem value="tracking">📦 Código de rastreio (BR...)</SelectItem>
            <SelectItem value="order_id">🧾 Número do pedido (SA...)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          "Auto" detecta se começa com BR/LP (rastreio) ou outro prefixo (pedido)
        </p>
      </div>

      {/* Variável fonte — dropdown com ancestrais */}
      <div className="space-y-1.5">
        <Label className="text-xs">De onde vem o código?</Label>
        <Select
          value={isCustomSource ? "__custom__" : (currentSource || "__last_message__")}
          onValueChange={(v) => {
            if (v === "__last_message__") {
              updateNodeData("source_variable", "");
            } else if (v === "__custom__") {
              updateNodeData("source_variable", "");
            } else {
              updateNodeData("source_variable", v);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__last_message__">💬 Última mensagem do cliente</SelectItem>
            {ancestorVariables.length > 0 && (
              <SelectGroup>
                <SelectLabel>Variáveis coletadas no fluxo</SelectLabel>
                {ancestorVariables.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    💾 {v.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Selecione de qual nó anterior vem o código de rastreio ou pedido
        </p>
      </div>

      {/* Variáveis de saída - READ ONLY */}
      <div className="pt-2 border-t space-y-2">
        <Label className="text-xs font-semibold">Variáveis geradas automaticamente</Label>
        <p className="text-[10px] text-muted-foreground">
          Clique para copiar e usar em nós seguintes
        </p>
        <div className="space-y-1.5">
          <ReadOnlyVariableBadge variable="order_found" description="true/false — Pedido encontrado?" colorClass="text-green-600" />
          <ReadOnlyVariableBadge variable="order_status" description="Status: PACKED, SHIPPED, etc" colorClass="text-blue-600" />
          <ReadOnlyVariableBadge variable="packed_at_formatted" description='Data: "10/12/2025 às 10:17"' colorClass="text-purple-600" />
          <ReadOnlyVariableBadge variable="order_box_number" description="Código original informado" colorClass="text-amber-600" />
          <ReadOnlyVariableBadge variable="order_platform" description="Plataforma do pedido" colorClass="text-cyan-600" />
        </div>
      </div>
    </div>
  );
}
