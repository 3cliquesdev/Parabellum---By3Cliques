import { useState, useEffect } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldScoringConfig } from "@/components/forms/FieldScoringConfig";
import type { FormField, FormSchema, FormFieldType } from "@/hooks/useForms";

interface FormBuilderProps {
  schema: FormSchema;
  onChange: (schema: FormSchema) => void;
}

export default function FormBuilder({ schema, onChange }: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(schema.fields);

  // Sync fields when schema changes externally
  useEffect(() => {
    setFields(schema.fields);
  }, [schema.fields]);

  const addField = () => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: "text",
      label: "Novo Campo",
      required: false,
    };
    const updated = [...fields, newField];
    setFields(updated);
    onChange({ ...schema, fields: updated });
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    const updated = fields.map((f) => {
      if (f.id !== id) return f;
      
      const updatedField = { ...f, ...updates };
      
      // Clear scoring when changing to non-scoreable type
      if (updates.type && !["select", "yes_no", "rating"].includes(updates.type)) {
        delete updatedField.scoring;
      }
      
      // Clear options when changing from select to other type
      if (updates.type && updates.type !== "select" && f.type === "select") {
        delete updatedField.options;
      }
      
      return updatedField;
    });
    setFields(updated);
    onChange({ ...schema, fields: updated });
  };

  const removeField = (id: string) => {
    const updated = fields.filter((f) => f.id !== id);
    setFields(updated);
    onChange({ ...schema, fields: updated });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Campos do Formulário</h3>
        <Button type="button" onClick={addField} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Campo
        </Button>
      </div>

      {fields.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Nenhum campo adicionado. Clique em "Adicionar Campo" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => (
            <Card key={field.id}>
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Tipo de Campo</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value: FormFieldType) => updateField(field.id, { type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="phone">Telefone</SelectItem>
                        <SelectItem value="select">Seleção</SelectItem>
                        <SelectItem value="yes_no">Sim/Não</SelectItem>
                        <SelectItem value="rating">Avaliação (0-10)</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                        <SelectItem value="long_text">Texto Longo</SelectItem>
                        <SelectItem value="date">Data</SelectItem>
                        <SelectItem value="file">Arquivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Rótulo</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Ex: Nome completo"
                    />
                  </div>

                  <div>
                    <Label>Placeholder (opcional)</Label>
                    <Input
                      value={field.placeholder || ""}
                      onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                      placeholder="Ex: Digite seu nome"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`required-${field.id}`}
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          updateField(field.id, { required: checked as boolean })
                        }
                      />
                      <Label htmlFor={`required-${field.id}`} className="cursor-pointer">
                        Campo obrigatório
                      </Label>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(field.id)}
                      className="ml-auto text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {field.type === "select" && (
                    <div className="md:col-span-2">
                      <Label>Opções (separadas por vírgula)</Label>
                      <Input
                        value={field.options?.join(", ") || ""}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                          })
                        }
                        placeholder="Ex: Opção 1, Opção 2, Opção 3"
                      />
                    </div>
                  )}

                  {field.type === "rating" && (
                    <div className="md:col-span-2 flex gap-4">
                      <div className="flex-1">
                        <Label>Valor Mínimo</Label>
                        <Input
                          type="number"
                          value={field.min ?? 0}
                          onChange={(e) => updateField(field.id, { min: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Valor Máximo</Label>
                        <Input
                          type="number"
                          value={field.max ?? 10}
                          onChange={(e) => updateField(field.id, { max: parseInt(e.target.value) || 10 })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Scoring Configuration */}
                  <div className="md:col-span-2">
                    <FieldScoringConfig 
                      field={field} 
                      onUpdate={(updates) => updateField(field.id, updates)} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
