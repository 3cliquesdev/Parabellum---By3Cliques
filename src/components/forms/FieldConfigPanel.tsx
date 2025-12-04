import { FormField, FieldLogic } from "@/hooks/useForms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, X, GitBranch } from "lucide-react";
import { useState } from "react";

interface FieldConfigPanelProps {
  field: FormField;
  allFields: FormField[];
  onChange: (updates: Partial<FormField>) => void;
}

export function FieldConfigPanel({ field, allFields, onChange }: FieldConfigPanelProps) {
  const [newOption, setNewOption] = useState("");

  const handleAddOption = () => {
    if (newOption.trim()) {
      const options = field.options || [];
      onChange({ options: [...options, newOption.trim()] });
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    const options = field.options || [];
    onChange({ options: options.filter((_, i) => i !== index) });
  };

  const handleLogicChange = (updates: Partial<FieldLogic> | null) => {
    if (updates === null) {
      onChange({ logic: undefined });
    } else {
      onChange({ logic: { ...field.logic, ...updates } as FieldLogic });
    }
  };

  // Campos disponíveis para lógica (apenas campos anteriores)
  const currentIndex = allFields.findIndex((f) => f.id === field.id);
  const previousFields = allFields.slice(0, currentIndex);
  const nextFields = allFields.slice(currentIndex + 1);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-4">Configuração do Campo</h4>
      </div>

      {/* Pergunta */}
      <div className="space-y-2">
        <Label>Pergunta</Label>
        <Textarea
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Digite a pergunta..."
          rows={2}
        />
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Input
          value={field.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Texto de ajuda..."
        />
      </div>

      {/* Placeholder */}
      {["text", "email", "phone", "long_text", "number"].includes(field.type) && (
        <div className="space-y-2">
          <Label>Placeholder</Label>
          <Input
            value={field.placeholder || ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Texto de exemplo..."
          />
        </div>
      )}

      {/* Obrigatório */}
      <div className="flex items-center justify-between">
        <Label>Obrigatório</Label>
        <Switch
          checked={field.required || false}
          onCheckedChange={(checked) => onChange({ required: checked })}
        />
      </div>

      {/* Opções para Select */}
      {field.type === "select" && (
        <div className="space-y-3">
          <Label>Opções</Label>
          <div className="space-y-2">
            {(field.options || []).map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => {
                    const options = [...(field.options || [])];
                    options[index] = e.target.value;
                    onChange({ options });
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveOption(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder="Nova opção..."
              onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
            />
            <Button variant="outline" size="icon" onClick={handleAddOption}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Min/Max para Rating e Number */}
      {(field.type === "rating" || field.type === "number") && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mínimo</Label>
            <Input
              type="number"
              value={field.min ?? (field.type === "rating" ? 0 : "")}
              onChange={(e) => onChange({ min: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Máximo</Label>
            <Input
              type="number"
              value={field.max ?? (field.type === "rating" ? 10 : "")}
              onChange={(e) => onChange({ max: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <Separator />

      {/* Lógica Condicional */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <Label>Lógica Condicional</Label>
          </div>
          <Switch
            checked={!!field.logic}
            onCheckedChange={(checked) => {
              if (checked && previousFields.length > 0 && nextFields.length > 0) {
                handleLogicChange({
                  condition: "equals",
                  value: "",
                  jump_to: nextFields[0].id,
                });
              } else {
                handleLogicChange(null);
              }
            }}
            disabled={previousFields.length === 0 || nextFields.length === 0}
          />
        </div>

        {field.logic && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Se a resposta do campo anterior...
            </p>

            <Select
              value={field.logic.condition}
              onValueChange={(v) => handleLogicChange({ condition: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">É igual a</SelectItem>
                <SelectItem value="not_equals">Não é igual a</SelectItem>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="greater_than">Maior que</SelectItem>
                <SelectItem value="less_than">Menor que</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={field.logic.value}
              onChange={(e) => handleLogicChange({ value: e.target.value })}
              placeholder="Valor..."
            />

            <p className="text-xs text-muted-foreground">
              Então pular para:
            </p>

            <Select
              value={field.logic.jump_to}
              onValueChange={(v) => handleLogicChange({ jump_to: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {nextFields.map((f, i) => (
                  <SelectItem key={f.id} value={f.id}>
                    {currentIndex + i + 2}. {f.label.slice(0, 30)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {previousFields.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Adicione campos anteriores para usar lógica condicional.
          </p>
        )}
      </div>

      {/* Imagem de Fundo */}
      <div className="space-y-2">
        <Label>Imagem de Fundo (URL)</Label>
        <Input
          value={field.image_url || ""}
          onChange={(e) => onChange({ image_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
    </div>
  );
}
