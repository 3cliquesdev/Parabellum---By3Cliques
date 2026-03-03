import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface KnowledgeColumnMapperProps {
  csvHeaders: string[];
  mapping: Record<string, string>;
  onMappingChange: (field: string, csvColumn: string) => void;
}

const KNOWLEDGE_FIELDS = [
  { value: 'input', label: 'Coluna de ENTRADA (Pergunta/Problema) *', required: true },
  { value: 'output', label: 'Coluna de SAÍDA (Resposta/Solução) *', required: true },
  { value: 'category', label: 'Coluna de CATEGORIA (Opcional)', required: false },
  { value: 'tags', label: 'Coluna de TAGS (Opcional)', required: false },
];

export function KnowledgeColumnMapper({ csvHeaders, mapping, onMappingChange }: KnowledgeColumnMapperProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🔗 Mapeamento de Colunas</CardTitle>
        <CardDescription>
          Associe as colunas do arquivo com os campos da base de conhecimento.
          Campos marcados com * são obrigatórios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {KNOWLEDGE_FIELDS.map((field) => (
          <div key={field.value} className="space-y-2">
            <Label className="font-medium">{field.label}</Label>
            <Select
              value={mapping[field.value] ?? undefined}
              onValueChange={(value) => onMappingChange(field.value, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione coluna do arquivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não mapear</SelectItem>
                {csvHeaders.filter(h => h && h.trim() !== '').map((header) => (
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
