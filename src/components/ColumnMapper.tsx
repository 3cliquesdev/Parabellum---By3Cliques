import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ColumnMapperProps {
  csvHeaders: string[];
  mapping: Record<string, string>;
  onMappingChange: (field: string, csvColumn: string) => void;
}

const DB_FIELDS = [
  { value: 'first_name', label: 'Nome' },
  { value: 'last_name', label: 'Sobrenome' },
  { value: 'email', label: 'Email *' },
  { value: 'phone', label: 'Telefone' },
  { value: 'company', label: 'Empresa' },
  { value: 'document', label: 'CPF/CNPJ' },
  { value: 'state_registration', label: 'Inscrição Estadual (IE)' },
  { value: 'address', label: 'Endereço' },
  { value: 'address_number', label: 'Número' },
  { value: 'address_complement', label: 'Complemento' },
  { value: 'neighborhood', label: 'Bairro' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'zip_code', label: 'CEP' },
  { value: 'birth_date', label: 'Data de Nascimento' },
  { value: 'customer_type', label: 'Tipo de Cliente' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'subscription_plan', label: 'Plano de Assinatura' },
  { value: 'registration_date', label: 'Data de Cadastro' },
  { value: 'last_payment_date', label: 'Último Pagamento' },
  { value: 'next_payment_date', label: 'Próximo Pagamento' },
  { value: 'recent_orders_count', label: 'Pedidos Recentes' },
  { value: 'account_balance', label: 'Saldo da Conta' },
  { value: 'assigned_to', label: 'Consultor (Nome)' },
  { value: 'consultant_id', label: 'ID do Consultor (UUID)' },
];

export function ColumnMapper({ csvHeaders, mapping, onMappingChange }: ColumnMapperProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapeamento de Colunas</CardTitle>
        <CardDescription>
          Associe as colunas do seu CSV com os campos do banco de dados.
          O campo Email é obrigatório.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DB_FIELDS.map((field) => (
          <div key={field.value} className="grid grid-cols-2 gap-4 items-center">
            <Label className="font-medium">{field.label}</Label>
            <Select
              value={mapping[field.value] || ''}
              onValueChange={(value) => onMappingChange(field.value, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione coluna do CSV" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não mapear</SelectItem>
                {csvHeaders.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
