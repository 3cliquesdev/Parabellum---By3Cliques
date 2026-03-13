import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSalesReps } from "@/hooks/useSalesReps";

interface DealColumnMapperProps {
  csvHeaders: string[];
  mapping: Record<string, string>;
  onMappingChange: (field: string, csvColumn: string) => void;
  fixedAssignedTo?: string | null;
  onFixedAssignedToChange?: (userId: string | null) => void;
}

const DEAL_FIELDS = [
  { value: 'nome_cliente', label: 'Nome do Cliente' },
  { value: 'title', label: 'Título do Deal *' },
  { value: 'value', label: 'Valor (R$)' },
  { value: 'email_contato', label: 'Email do Contato' },
  { value: 'telefone_contato', label: 'Telefone do Contato' },
  { value: 'produto', label: 'Produto (nome)' },
  { value: 'assigned_to', label: 'Vendedor' },
  { value: 'expected_close_date', label: 'Data Prevista de Fechamento' },
  { value: 'external_order_id', label: 'ID do Pedido Externo' },
  { value: 'lead_source', label: 'Fonte do Lead' },
  { value: 'status', label: 'Status (open/won/lost)' },
];

type AssignedMode = 'csv' | 'fixed';

export function DealColumnMapper({ csvHeaders, mapping, onMappingChange, fixedAssignedTo, onFixedAssignedToChange }: DealColumnMapperProps) {
  const { data: salesReps } = useSalesReps();
  const [assignedMode, setAssignedMode] = useState<AssignedMode>(
    fixedAssignedTo !== undefined && fixedAssignedTo !== null ? 'fixed' : 'csv'
  );

  const handleModeChange = (mode: AssignedMode) => {
    setAssignedMode(mode);
    if (mode === 'csv') {
      onFixedAssignedToChange?.(null);
    } else {
      onMappingChange('assigned_to', '__none__');
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapeamento de Colunas</CardTitle>
        <CardDescription>
          Associe as colunas do seu CSV com os campos do deal. O campo Título é obrigatório.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DEAL_FIELDS.map((field) => {
          // Special handling for assigned_to field
          if (field.value === 'assigned_to') {
            return (
              <div key={field.value} className="space-y-3 border rounded-lg p-4 bg-muted/20">
                <Label className="font-medium">{field.label}</Label>
                <RadioGroup
                  value={assignedMode}
                  onValueChange={(v) => handleModeChange(v as AssignedMode)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="csv" id="assigned-csv" />
                    <Label htmlFor="assigned-csv" className="cursor-pointer text-sm">Coluna do CSV</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="assigned-fixed" />
                    <Label htmlFor="assigned-fixed" className="cursor-pointer text-sm">Vendedor fixo</Label>
                  </div>
                </RadioGroup>

                {assignedMode === 'csv' ? (
                  <Select
                    value={mapping[field.value] ?? undefined}
                    onValueChange={(value) => onMappingChange(field.value, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione coluna do CSV" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não mapear</SelectItem>
                      {csvHeaders.filter(h => h && h.trim() !== '').map((header) => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={fixedAssignedTo ?? undefined}
                    onValueChange={(value) => onFixedAssignedToChange?.(value === '__none__' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {salesReps?.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={rep.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">{getInitials(rep.full_name || '')}</AvatarFallback>
                            </Avatar>
                            <span>{rep.full_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          }

          // Default field rendering
          return (
            <div key={field.value} className="grid grid-cols-2 gap-4 items-center">
              <Label className="font-medium">{field.label}</Label>
              <Select
                value={mapping[field.value] ?? undefined}
                onValueChange={(value) => onMappingChange(field.value, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione coluna do CSV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Não mapear</SelectItem>
                  {csvHeaders.filter(h => h && h.trim() !== '').map((header) => (
                    <SelectItem key={header} value={header}>{header}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
