import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DealColumnMapperProps {
  csvHeaders: string[];
  mapping: Record<string, string>;
  onMappingChange: (field: string, csvColumn: string) => void;
}

const DEAL_FIELDS = [
  { value: 'nome_cliente', label: 'Nome do Cliente' },
  { value: 'title', label: 'Título do Deal *' },
  { value: 'value', label: 'Valor (R$)' },
  { value: 'email_contato', label: 'Email do Contato' },
  { value: 'telefone_contato', label: 'Telefone do Contato' },
  { value: 'produto', label: 'Produto (nome)' },
  { value: 'assigned_to', label: 'Vendedor (nome)' },
  { value: 'expected_close_date', label: 'Data Prevista de Fechamento' },
  { value: 'external_order_id', label: 'ID do Pedido Externo' },
  { value: 'lead_source', label: 'Fonte do Lead' },
  { value: 'status', label: 'Status (open/won/lost)' },
];

export function DealColumnMapper({ csvHeaders, mapping, onMappingChange }: DealColumnMapperProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapeamento de Colunas</CardTitle>
        <CardDescription>
          Associe as colunas do seu CSV com os campos do deal. O campo Título é obrigatório.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DEAL_FIELDS.map((field) => (
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
        ))}
      </CardContent>
    </Card>
  );
}
