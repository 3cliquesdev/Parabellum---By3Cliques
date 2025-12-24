import { useState } from 'react';
import { Settings2, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface OctadeskImportOptions {
  categorySource: 'department' | 'tags' | 'custom';
  customCategory?: string;
  skipUnsatisfied: boolean;
}

interface OctadeskImportConfigProps {
  selectedCount: number;
  onImport: (options: OctadeskImportOptions) => void;
  isImporting: boolean;
}

export function OctadeskImportConfig({
  selectedCount,
  onImport,
  isImporting,
}: OctadeskImportConfigProps) {
  const [options, setOptions] = useState<OctadeskImportOptions>({
    categorySource: 'department',
    skipUnsatisfied: true,
  });

  const handleImport = () => {
    onImport(options);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Configurações de Importação
        </CardTitle>
        <CardDescription>
          Configure como as conversas serão processadas pela IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Category Source */}
        <div className="space-y-3">
          <Label>Categoria dos artigos</Label>
          <RadioGroup
            value={options.categorySource}
            onValueChange={(value: OctadeskImportOptions['categorySource']) =>
              setOptions(o => ({ ...o, categorySource: value }))
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="department" id="department" />
              <Label htmlFor="department" className="font-normal cursor-pointer">
                Usar departamento como categoria
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="tags" id="tags" />
              <Label htmlFor="tags" className="font-normal cursor-pointer">
                Usar primeira tag como categoria
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="font-normal cursor-pointer">
                Categoria fixa: "Suporte Octadesk"
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Skip Unsatisfied */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Pular avaliações negativas</Label>
            <p className="text-sm text-muted-foreground">
              Não processar conversas com avaliação "insatisfeito"
            </p>
          </div>
          <Switch
            checked={options.skipUnsatisfied}
            onCheckedChange={(checked) =>
              setOptions(o => ({ ...o, skipUnsatisfied: checked }))
            }
          />
        </div>

        {/* Import Button */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleImport}
            disabled={selectedCount === 0 || isImporting}
            className="w-full"
            size="lg"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Importar {selectedCount} conversa{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
          {selectedCount === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Selecione ao menos uma conversa para importar
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
