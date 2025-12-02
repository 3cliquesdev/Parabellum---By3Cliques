import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, Loader2, Zap, FileText, Table } from "lucide-react";
import { UniversalFileUploader } from "@/components/UniversalFileUploader";
import { DocumentUploader } from "@/components/DocumentUploader";
import { KnowledgeColumnMapper } from "@/components/KnowledgeColumnMapper";
import { DataPreviewTable } from "@/components/DataPreviewTable";
import { KnowledgeImportProgress } from "@/components/KnowledgeImportProgress";
import { useImportKnowledge } from "@/hooks/useImportKnowledge";
import { useImportDocument } from "@/hooks/useImportDocument";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

export default function KnowledgeImport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isManager, isGeneralManager, loading: roleLoading } = useUserRole();
  
  // CSV/Excel state
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    input: '__none__',
    output: '__none__',
    category: '__none__',
    tags: '__none__',
  });
  const [csvMode, setCsvMode] = useState<'raw_history' | 'ready_faq'>('ready_faq');
  const [csvImportResult, setCsvImportResult] = useState<any>(null);
  const [hasManualMapping, setHasManualMapping] = useState(false);

  // Document state
  const [documentText, setDocumentText] = useState<string>("");
  const [documentFileName, setDocumentFileName] = useState<string>("");
  const [documentPageCount, setDocumentPageCount] = useState<number | undefined>();
  const [documentCategory, setDocumentCategory] = useState<string>("Importado");
  const [documentTags, setDocumentTags] = useState<string>("");
  const [documentMode, setDocumentMode] = useState<'full_document' | 'split_sections'>('full_document');
  const [documentImportResult, setDocumentImportResult] = useState<any>(null);

  const csvImportMutation = useImportKnowledge();
  const documentImportMutation = useImportDocument();

  useEffect(() => {
    console.log('[KnowledgeImport] Role check:', { 
      roleLoading, 
      isAdmin, 
      isManager,
      hasAccess: isAdmin || isManager 
    });
  }, [roleLoading, isAdmin, isManager]);

  // Auto-detect column mapping for CSV
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
    setCsvImportResult(null);
  };

  const handleTextExtracted = (text: string, fileName: string, pageCount?: number) => {
    setDocumentText(text);
    setDocumentFileName(fileName);
    setDocumentPageCount(pageCount);
    setDocumentImportResult(null);
  };

  const handleMappingChange = (field: string, csvColumn: string) => {
    setHasManualMapping(true);
    setMapping(prev => ({ ...prev, [field]: csvColumn }));
  };

  const handleClearCsv = () => {
    setCsvData([]);
    setCsvHeaders([]);
    setMapping({
      input: '__none__',
      output: '__none__',
      category: '__none__',
      tags: '__none__',
    });
    setCsvImportResult(null);
    setHasManualMapping(false);
  };

  const handleClearDocument = () => {
    setDocumentText("");
    setDocumentFileName("");
    setDocumentPageCount(undefined);
    setDocumentCategory("Importado");
    setDocumentTags("");
    setDocumentImportResult(null);
  };

  const handleImportCsv = async () => {
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
      const result = await csvImportMutation.mutateAsync({
        rows,
        mode: csvMode,
        source: 'manual_import',
      });
      setCsvImportResult(result);
    } catch (error) {
      console.error('CSV import error:', error);
    }
  };

  const handleImportDocument = async () => {
    if (!documentText.trim()) {
      toast({
        title: "Nenhum texto extraído",
        description: "Faça upload de um documento primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      const tagsArray = documentTags.split(',').map(t => t.trim()).filter(Boolean);
      
      const result = await documentImportMutation.mutateAsync({
        text: documentText,
        fileName: documentFileName,
        category: documentCategory,
        tags: tagsArray,
        mode: documentMode,
      });
      
      setDocumentImportResult(result);
    } catch (error) {
      console.error('Document import error:', error);
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

  if (!isAdmin && !isManager && !isGeneralManager) {
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
            Alimente a IA com planilhas, documentos PDF ou Word
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="spreadsheets" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="spreadsheets" className="gap-2">
            <Table className="h-4 w-4" />
            Planilhas
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        {/* Spreadsheets Tab */}
        <TabsContent value="spreadsheets" className="space-y-6">
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
                  <RadioGroup value={csvMode} onValueChange={(v) => setCsvMode(v as any)}>
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
          {csvHeaders.length > 0 && !csvImportResult && (
            <div className="flex gap-4">
              <Button variant="outline" onClick={handleClearCsv}>
                Limpar
              </Button>
              <Button 
                onClick={handleImportCsv}
                disabled={csvImportMutation.isPending}
                className="gap-2"
              >
                {csvImportMutation.isPending ? (
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
          {csvImportResult && (
            <KnowledgeImportProgress
              progress={csvData.length}
              total={csvData.length}
              created={csvImportResult.created}
              skipped={csvImportResult.skipped}
              errors={csvImportResult.errors}
              isProcessing={false}
            />
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          {/* Step 1: Upload Document */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Etapa 1: Upload do Documento</h2>
            <DocumentUploader onTextExtracted={handleTextExtracted} />
          </div>

          {/* Step 2: Document Details */}
          {documentText && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Etapa 2: Detalhes do Documento</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle>📄 Informações Extraídas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="secondary" className="font-mono">
                      {documentText.length.toLocaleString()} caracteres
                    </Badge>
                    {documentPageCount && (
                      <Badge variant="secondary">
                        {documentPageCount} página{documentPageCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document-category">Categoria</Label>
                    <Input
                      id="document-category"
                      value={documentCategory}
                      onChange={(e) => setDocumentCategory(e.target.value)}
                      placeholder="Ex: Manual, Documentação, Guia..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document-tags">Tags (separadas por vírgula)</Label>
                    <Input
                      id="document-tags"
                      value={documentTags}
                      onChange={(e) => setDocumentTags(e.target.value)}
                      placeholder="Ex: produto, instalação, troubleshooting"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 3: Processing Mode */}
              <h2 className="text-xl font-semibold text-foreground">Etapa 3: Modo de Processamento</h2>
              <Card>
                <CardHeader>
                  <CardTitle>🤖 Como processar este documento?</CardTitle>
                  <CardDescription>
                    Escolha se deseja criar um único artigo ou dividir em seções
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={documentMode} onValueChange={(v) => setDocumentMode(v as any)}>
                    <div className="flex items-start space-x-3 space-y-0 rounded-md border border-border p-4">
                      <RadioGroupItem value="full_document" id="full_document" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="full_document" className="font-medium cursor-pointer">
                          <FileText className="inline h-4 w-4 mr-2" />
                          Documento Completo
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Criar UM único artigo com todo o conteúdo<br />
                          Ideal para documentos curtos e focados
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 space-y-0 rounded-md border border-border p-4">
                      <RadioGroupItem value="split_sections" id="split_sections" />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="split_sections" className="font-medium cursor-pointer">
                          <Brain className="inline h-4 w-4 mr-2" />
                          Dividir em Seções
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          IA identifica tópicos e cria MÚLTIPLOS artigos<br />
                          Ideal para manuais extensos e guias completos<br />
                          ⚠️ Usa mais tokens de IA
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Actions */}
              {!documentImportResult && (
                <div className="flex gap-4">
                  <Button variant="outline" onClick={handleClearDocument}>
                    Limpar
                  </Button>
                  <Button 
                    onClick={handleImportDocument}
                    disabled={documentImportMutation.isPending}
                    className="gap-2"
                  >
                    {documentImportMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processando com IA...
                      </>
                    ) : (
                      <>
                        🤖 Processar com IA
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Progress */}
              {documentImportResult && (
                <KnowledgeImportProgress
                  progress={1}
                  total={1}
                  created={documentImportResult.created}
                  skipped={documentImportResult.skipped}
                  errors={documentImportResult.errors}
                  isProcessing={false}
                />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
