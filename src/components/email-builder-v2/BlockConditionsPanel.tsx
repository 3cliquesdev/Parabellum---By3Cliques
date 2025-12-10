import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Eye, EyeOff, GitBranch } from "lucide-react";
import { 
  BlockCondition, 
  ConditionOperator, 
  ConditionAction, 
  LogicGroup 
} from "@/types/emailBuilderV2";
import { useEmailVariables } from "@/hooks/useEmailBuilderV2";

interface BlockConditionsPanelProps {
  blockId: string;
  conditions: BlockCondition[];
  onConditionsChange: (conditions: BlockCondition[]) => void;
}

const operatorLabels: Record<ConditionOperator, string> = {
  equals: "é igual a",
  not_equals: "é diferente de",
  greater_than: "é maior que",
  less_than: "é menor que",
  contains: "contém",
  is_empty: "está vazio",
  is_not_empty: "não está vazio",
};

export function BlockConditionsPanel({
  blockId,
  conditions,
  onConditionsChange,
}: BlockConditionsPanelProps) {
  const { data: variables } = useEmailVariables();
  const [isOpen, setIsOpen] = useState(conditions.length > 0);

  const addCondition = () => {
    const newCondition: BlockCondition = {
      id: crypto.randomUUID(),
      block_id: blockId,
      field: "",
      operator: "equals",
      value: "",
      logic_group: "AND",
      group_index: 0,
      action: "show",
    };
    onConditionsChange([...conditions, newCondition]);
    setIsOpen(true);
  };

  const updateCondition = (id: string, updates: Partial<BlockCondition>) => {
    onConditionsChange(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const removeCondition = (id: string) => {
    onConditionsChange(conditions.filter((c) => c.id !== id));
  };

  const getActionIcon = (action: ConditionAction) => {
    return action === "show" ? (
      <Eye className="h-4 w-4 text-green-500" />
    ) : (
      <EyeOff className="h-4 w-4 text-red-500" />
    );
  };

  if (!isOpen && conditions.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={addCondition}
        className="w-full justify-start text-muted-foreground hover:text-foreground"
      >
        <GitBranch className="h-4 w-4 mr-2" />
        Adicionar Condição
      </Button>
    );
  }

  return (
    <div className="space-y-3 p-3 border border-border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Condições de Exibição</span>
          {conditions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {conditions.length}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={addCondition}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="max-h-64">
        <div className="space-y-3">
          {conditions.map((condition, idx) => (
            <div
              key={condition.id}
              className="space-y-2 p-3 border border-border rounded-md bg-background"
            >
              {idx > 0 && (
                <div className="flex justify-center -mt-5 -mb-1">
                  <Select
                    value={condition.logic_group}
                    onValueChange={(value: LogicGroup) =>
                      updateCondition(condition.id, { logic_group: value })
                    }
                  >
                    <SelectTrigger className="w-20 h-6 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">E</SelectItem>
                      <SelectItem value="OR">OU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-12 gap-2 items-end">
                {/* Action */}
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Ação</Label>
                  <Select
                    value={condition.action}
                    onValueChange={(value: ConditionAction) =>
                      updateCondition(condition.id, { action: value })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <div className="flex items-center gap-1">
                        {getActionIcon(condition.action)}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="show">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-green-500" />
                          Mostrar
                        </div>
                      </SelectItem>
                      <SelectItem value="hide">
                        <div className="flex items-center gap-2">
                          <EyeOff className="h-4 w-4 text-red-500" />
                          Ocultar
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Field */}
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">Campo</Label>
                  <Select
                    value={condition.field}
                    onValueChange={(value) =>
                      updateCondition(condition.id, { field: value })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {variables?.map((v) => (
                        <SelectItem key={v.id} value={v.variable_key}>
                          {v.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Operator */}
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">
                    Operador
                  </Label>
                  <Select
                    value={condition.operator}
                    onValueChange={(value: ConditionOperator) =>
                      updateCondition(condition.id, { operator: value })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(operatorLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Value */}
                <div className="col-span-3">
                  <Label className="text-xs text-muted-foreground">Valor</Label>
                  <Input
                    value={condition.value}
                    onChange={(e) =>
                      updateCondition(condition.id, { value: e.target.value })
                    }
                    placeholder="Valor..."
                    className="h-8 text-xs"
                    disabled={
                      condition.operator === "is_empty" ||
                      condition.operator === "is_not_empty"
                    }
                  />
                </div>

                {/* Delete */}
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(condition.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {conditions.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          Este bloco será{" "}
          <span className="font-medium">
            {conditions[0]?.action === "show" ? "exibido" : "ocultado"}
          </span>{" "}
          quando as condições forem atendidas.
        </div>
      )}
    </div>
  );
}
