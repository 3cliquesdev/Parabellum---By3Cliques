import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Brain, Loader2, Zap } from "lucide-react";
import { UniversalFileUploader } from "@/components/UniversalFileUploader";
import { KnowledgeColumnMapper } from "@/components/KnowledgeColumnMapper";
import { DataPreviewTable } from "@/components/DataPreviewTable";
import { KnowledgeImportProgress } from "@/components/KnowledgeImportProgress";
import { useImportKnowledge } from "@/hooks/useImportKnowledge";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

export default function KnowledgeImport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    input: '__none__',
    output: '__none__',
    category: '__none__',
    tags: '__none__',
  });
  const [mode, setMode] = useState<'raw_history' | 'ready_faq'>('ready_faq');
  const [importResult, setImportResult] = useState<any>(null);
  const [hasManualMapping, setHasManualMapping] = useState(false);

  const importMutation = useImportKnowledge();

  // Permission check moved to render section for better control

  // Auto-detect column mapping (only if user hasn't manually mapped)
  useEffect(() => {
    if (csvHeaders.length === 0 || hasManualMapping) return;

    const newMapping = { ...mapping };
    
    csvHeaders.forEach(header => {
      const lowerHeader = header.toLowerCase();
      
      if (!newMapping.input || newMapping.input === '__none__') {
        if (lowerHeader.includes('pergunta') || lowerHeader.includes('problema') || 
            lowerHeader.includes('duvida') || lowerHeader.includes('entrada') ||
            lowerHeader.includes('msg cliente') || lowerHeader.includes('assunto')) {
          newMapping.input = header;
        }
      }
      
      if (!newMapping.output || newMapping.output === '__none__') {
        if (lowerHeader.includes('resposta') || lowerHeader.includes('solucao') || 
            lowerHeader.includes('saida') || lowerHeader.includes('resolucao') ||
            lowerHeader.includes('msg agente')) {
          newMapping.output = header;
        }
      }
      
      if (!newMapping.category || newMapping.category === '__none__') {
        if (lowerHeader.includes('categoria') || lowerHeader.includes('category') ||
            lowerHeader.includes('tipo')) {
          newMapping.category = header;
        }
      }
      
      if (!newMapping.tags || newMapping.tags === '__none__') {
        if (lowerHeader.includes('tag') || lowerHeader.includes('etiqueta')) {
          newMapping.tags = header;
        }
      }
    });
    
    setMapping(newMapping);
  }, [csvHeaders, hasManualMapping]);

  const handleDataParsed = (data: any[], headers: string[]) => {
    setCsvData(data);
    setCsvHeaders(headers);
    setImportResult(null);
  };

  const handleMappingChange = (field: string, csvColumn: string) => {
    setHasManualMapping(true);
    setMapping(prev => ({ ...prev, [field]: csvColumn }));
  };

  const handleClear = () => {
    setCsvData([]);
    setCsvHeaders([]);
    setMapping({
      input: '__none__',
      output: '__none__',
      category: '__none__',
      tags: '__none__',
    });
    setImportResult(null);
    setHasManualMapping(false);
  };

  const handleImport = async () => {
    if (mapping.input === '__none__' || mapping.output === '__none__') {
      toast({
        title: "Mapeamento incompleto",
        description: "Você precisa mapear pelo menos as colunas de Entrada e Saída.",
        variant: "destructive",
      });
      return;
    }

    const rows = csvData.map(row => ({
      input: String(row[mapping.input] || ''),
      output: String(row[mapping.output] || ''),
      category: mapping.category !== '__none__' ? String(row[mapping.category] || '') : undefined,
      tags: mapping.tags !== '__none__' ? String(row[mapping.tags] || '') : undefined,
    })).filter(row => row.input && row.output);

    if (rows.length === 0) {
      toast({
        title: "Nenhum dado válido",
        description: "Não foram encontradas linhas com Entrada e Saída preenchidas.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        rows,
        mode,
        source: 'manual_import',
      });
      setImportResult(result);
    } catch (error) {
      console.error('Import error:', error);
    }
  };

  const highlightedColumns = [
    mapping.input !== '__none__' ? mapping.input : null,
    mapping.output !== '__none__' ? mapping.output : null,
  ].filter(Boolean) as string[];

  if (roleLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !isManager) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Acesso Negado</CardTitle>
            <CardDescription>
              Apenas administradores e gerentes podem acessar esta página.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/knowledge')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Base de Conhecimento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/knowledge')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            Importador Universal de Conhecimento
          </h1>
          <p className="text-muted-foreground mt-2">
            Alimente a IA com exports do Octadesk, Zendesk ou Excel
          </p>
        </div>
      </div>

      {/* Step 1: Upload */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Etapa 1: Upload</h2>
        <UniversalFileUploader onDataParsed={handleDataParsed} />
      </div>

      {/* Step 2: Column Mapping */}
      {csvHeaders.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Etapa 2: Mapeamento de Colunas</h2>
          <DataPreviewTable 
            data={csvData} 
            headers={csvHeaders}
            highlightedColumns={highlightedColumns}
          />
          <KnowledgeColumnMapper
            csvHeaders={csvHeaders}
            mapping={mapping}
            onMappingChange={handleMappingChange}
          />
        </div>
      )}

      {/* Step 3: Processing Mode */}
      {csvHeaders.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Etapa 3: Modo de Processamento</h2>
          <Card>
            <CardHeader>
              <CardTitle>🤖 Como a IA deve tratar os dados?</CardTitle>
              <CardDescription>
                Escolha o modo de processamento adequado para seu tipo de arquivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border border-border p-4">
                  <RadioGroupItem value="raw_history" id="raw_history" />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="raw_history" className="font-medium cursor-pointer">
                      <Brain className="inline h-4 w-4 mr-2" />
                      Histórico Bruto (Chat)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Exports de chat com "bom dia", "aguarde", etc.<br />
                      A IA vai limpar e extrair o par Problema/Solução<br />
                      ⚠️ Mais lento e usa mais tokens
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border border-border p-4">
                  <RadioGroupItem value="ready_faq" id="ready_faq" />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="ready_faq" className="font-medium cursor-pointer">
                      <Zap className="inline h-4 w-4 mr-2" />
                      FAQ Pronto (Direto)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Planilhas já organizadas com Pergunta/Resposta<br />
                      Importação direta sem processamento IA<br />
                      ⚡ Mais rápido e econômico
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      {csvHeaders.length > 0 && !importResult && (
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleClear}>
            Limpar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="gap-2"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                Importar {csvData.length} Itens
              </>
            )}
          </Button>
        </div>
      )}

      {/* Progress */}
      {importResult && (
        <KnowledgeImportProgress
          progress={csvData.length}
          total={csvData.length}
          created={importResult.created}
          skipped={importResult.skipped}
          errors={importResult.errors}
          isProcessing={false}
        />
      )}
    </div>
  );
}
