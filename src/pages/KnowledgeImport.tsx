import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, Loader2, Zap, FileText, Table, AlertTriangle, MessageSquare } from "lucide-react";
import { UniversalFileUploader } from "@/components/UniversalFileUploader";
import { DocumentUploader } from "@/components/DocumentUploader";
import { KnowledgeColumnMapper } from "@/components/KnowledgeColumnMapper";
import { DataPreviewTable } from "@/components/DataPreviewTable";
import { KnowledgeImportProgress } from "@/components/KnowledgeImportProgress";
import { KnowledgeTemplateDownload } from "@/components/knowledge/KnowledgeTemplateDownload";
import { useImportKnowledge } from "@/hooks/useImportKnowledge";
import { useImportDocument } from "@/hooks/useImportDocument";
import { useImportOctadesk } from "@/hooks/useImportOctadesk";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OctadeskFileUploader } from "@/components/octadesk/OctadeskFileUploader";
import { OctadeskConversationTable } from "@/components/octadesk/OctadeskConversationTable";
import { OctadeskImportConfig, OctadeskImportOptions } from "@/components/octadesk/OctadeskImportConfig";
import { OctadeskConnectionTest } from "@/components/octadesk/OctadeskConnectionTest";
import { OctadeskConversation } from "@/utils/octadeskParser";
import { Progress } from "@/components/ui/progress";
const LOG_PREFIX = '[KnowledgeImport]';

const logInfo = (message: string, data?: Record<string, unknown>) => {
  console.info(`${LOG_PREFIX} ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

const logError = (message: string, error?: unknown, context?: Record<string, unknown>) => {
  const errorDetails = error instanceof Error 
    ? { message: error.message, stack: error.stack }
    : error ? { raw: String(error) } : null;
  console.error(`${LOG_PREFIX} ${message}`, { error: errorDetails, context });
};

const logWarn = (message: string, data?: Record<string, unknown>) => {
  console.warn(`${LOG_PREFIX} ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

export default function KnowledgeImport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const { data: validCategories = [] } = useKnowledgeCategories();
  
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
  const [importError, setImportError] = useState<string | null>(null);

  // Document state
  const [documentText, setDocumentText] = useState<string>("");
  const [documentFileName, setDocumentFileName] = useState<string>("");
  const [documentPageCount, setDocumentPageCount] = useState<number | undefined>();
  const [documentCategory, setDocumentCategory] = useState<string>("Importado");
  const [documentTags, setDocumentTags] = useState<string>("");
  const [documentMode, setDocumentMode] = useState<'full_document' | 'split_sections'>('full_document');
  const [documentImportResult, setDocumentImportResult] = useState<any>(null);

  // Octadesk state
  const [octadeskConversations, setOctadeskConversations] = useState<OctadeskConversation[]>([]);
  const [octadeskSelectedIds, setOctadeskSelectedIds] = useState<Set<string>>(new Set());
  const [octadeskImportResult, setOctadeskImportResult] = useState<any>(null);

  const csvImportMutation = useImportKnowledge();
  const documentImportMutation = useImportDocument();
  const { importConversations, isImporting: isOctadeskImporting, progress: octadeskProgress } = useImportOctadesk();

  useEffect(() => {
    logInfo('Component mounted', { timestamp: new Date().toISOString() });
  }, []);

  useEffect(() => {
    logInfo('Permission check', { 
      permLoading, 
      hasKnowledgePermission: !permLoading && hasPermission("knowledge.manage_articles")
    });
  }, [permLoading, hasPermission]);

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

  const handleDataParsed = useCallback((data: any[], headers: string[]) => {
    logInfo('Data parsed from file', { 
      rowCount: data.length, 
      headerCount: headers.length,
      headers,
      sampleData: data.slice(0, 2).map(row => Object.keys(row))
    });
    
    setCsvData(data);
    setCsvHeaders(headers);
    setCsvImportResult(null);
    setImportError(null);
    
    if (data.length === 0 && headers.length === 0) {
      logInfo('File cleared or empty data received');
    }
  }, []);

  const handleTextExtracted = useCallback((text: string, fileName: string, pageCount?: number) => {
    logInfo('Document text extracted', { 
      fileName, 
      textLength: text.length,
      pageCount,
      preview: text.substring(0, 100) + '...'
    });
    
    setDocumentText(text);
    setDocumentFileName(fileName);
    setDocumentPageCount(pageCount);
    setDocumentImportResult(null);
    setImportError(null);
  }, []);

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

  const handleOctadeskDataParsed = useCallback((conversations: OctadeskConversation[]) => {
    logInfo('Octadesk data parsed', { conversationCount: conversations.length });
    setOctadeskConversations(conversations);
    setOctadeskSelectedIds(new Set());
    setOctadeskImportResult(null);
    setImportError(null);
  }, []);

  const handleOctadeskImport = async (options: OctadeskImportOptions) => {
    const selectedConversations = octadeskConversations.filter(c => octadeskSelectedIds.has(c.id));
    
    logInfo('Starting Octadesk import', { 
      selectedCount: selectedConversations.length,
      options 
    });

    try {
      const result = await importConversations(selectedConversations, options);
      setOctadeskImportResult(result);
      logInfo('Octadesk import completed', { 
        articlesCreated: result.articlesCreated,
        skipped: result.skipped,
        failed: result.failed 
      });
    } catch (error) {
      logError('Octadesk import failed', error);
      setImportError(error instanceof Error ? error.message : 'Erro na importação');
    }
  };

  const handleClearOctadesk = () => {
    setOctadeskConversations([]);
    setOctadeskSelectedIds(new Set());
    setOctadeskImportResult(null);
  };

  const handleImportCsv = async () => {
    logInfo('Starting CSV import', { 
      totalRows: csvData.length,
      mode: csvMode,
      mapping 
    });
    
    setImportError(null);

    if (mapping.input === '__none__' || mapping.output === '__none__') {
      const error = "Mapeamento incompleto: colunas de Entrada e Saída são obrigatórias.";
      logWarn('Import validation failed', { reason: 'incomplete_mapping', mapping });
      setImportError(error);
      toast({
        title: "Mapeamento incompleto",
        description: "Você precisa mapear pelo menos as colunas de Entrada e Saída.",
        variant: "destructive",
      });
      return;
    }

    const rows = csvData.map((row, index) => {
      const mapped = {
        input: String(row[mapping.input] || ''),
        output: String(row[mapping.output] || ''),
        category: mapping.category !== '__none__' ? String(row[mapping.category] || '') : undefined,
        tags: mapping.tags !== '__none__' ? String(row[mapping.tags] || '') : undefined,
      };
      
      if (!mapped.input || !mapped.output) {
        logWarn('Row skipped due to missing data', { rowIndex: index, hasInput: !!mapped.input, hasOutput: !!mapped.output });
      }
      
      return mapped;
    }).filter(row => row.input && row.output);

    logInfo('Rows prepared for import', { 
      originalCount: csvData.length,
      validCount: rows.length,
      skippedCount: csvData.length - rows.length
    });

    if (rows.length === 0) {
      const error = "Nenhuma linha válida encontrada com Entrada e Saída preenchidas.";
      logWarn('No valid rows', { mapping, sampleRow: csvData[0] });
      setImportError(error);
      toast({
        title: "Nenhum dado válido",
        description: "Não foram encontradas linhas com Entrada e Saída preenchidas.",
        variant: "destructive",
      });
      return;
    }

    try {
      logInfo('Calling import mutation', { rowCount: rows.length, mode: csvMode });
      const startTime = Date.now();
      
      const result = await csvImportMutation.mutateAsync({
        rows,
        mode: csvMode,
        source: 'manual_import',
      });
      
      const duration = Date.now() - startTime;
      logInfo('Import completed successfully', { 
        duration: `${duration}ms`,
        created: result.created,
        skipped: result.skipped,
        errors: result.errors?.length || 0
      });
      
      setCsvImportResult(result);
      
      if (result.errors && result.errors.length > 0) {
        logWarn('Import completed with errors', { errors: result.errors });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na importação';
      logError('CSV import failed', error, { rowCount: rows.length, mode: csvMode });
      setImportError(errorMessage);
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleImportDocument = async () => {
    logInfo('Starting document import', { 
      fileName: documentFileName,
      textLength: documentText.length,
      category: documentCategory,
      mode: documentMode
    });
    
    setImportError(null);

    if (!documentText.trim()) {
      const error = "Nenhum texto extraído do documento.";
      logWarn('Document import validation failed', { reason: 'empty_text' });
      setImportError(error);
      toast({
        title: "Nenhum texto extraído",
        description: "Faça upload de um documento primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      const tagsArray = documentTags.split(',').map(t => t.trim()).filter(Boolean);
      
      logInfo('Calling document import mutation', { 
        textLength: documentText.length,
        tagsCount: tagsArray.length,
        mode: documentMode
      });
      
      const startTime = Date.now();
      
      const result = await documentImportMutation.mutateAsync({
        text: documentText,
        fileName: documentFileName,
        category: documentCategory,
        tags: tagsArray,
        mode: documentMode,
      });
      
      const duration = Date.now() - startTime;
      logInfo('Document import completed', { 
        duration: `${duration}ms`,
        created: result.created,
        errors: result.errors?.length || 0
      });
      
      setDocumentImportResult(result);
      
      if (result.errors && result.errors.length > 0) {
        logWarn('Document import completed with errors', { errors: result.errors });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na importação';
      logError('Document import failed', error, { fileName: documentFileName, mode: documentMode });
      setImportError(errorMessage);
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const highlightedColumns = [
    mapping.input !== '__none__' ? mapping.input : null,
    mapping.output !== '__none__' ? mapping.output : null,
  ].filter(Boolean) as string[];

  if (permLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission("knowledge.manage_articles")) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
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

      {/* Error Alert */}
      {importError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro na importação</AlertTitle>
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="spreadsheets" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="spreadsheets" className="gap-2">
            <Table className="h-4 w-4" />
            Planilhas
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="octadesk" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Octadesk
          </TabsTrigger>
        </TabsList>

        {/* Spreadsheets Tab */}
        <TabsContent value="spreadsheets" className="space-y-6">
          {/* Template Download */}
          <KnowledgeTemplateDownload />
          
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

        {/* Octadesk Tab */}
        <TabsContent value="octadesk" className="space-y-6">
          {/* Step 0: Connection Test */}
          <div className="space-y-4">
            <OctadeskConnectionTest />
          </div>

          {/* Step 1: Upload JSON */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Etapa 1: Upload do Arquivo Octadesk</h2>
            <OctadeskFileUploader 
              onDataParsed={handleOctadeskDataParsed}
              isLoading={isOctadeskImporting}
            />
          </div>

          {/* Step 2: Select Conversations */}
          {octadeskConversations.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Etapa 2: Selecionar Conversas</h2>
              <OctadeskConversationTable
                conversations={octadeskConversations}
                selectedIds={octadeskSelectedIds}
                onSelectionChange={setOctadeskSelectedIds}
              />
            </div>
          )}

          {/* Step 3: Config and Import */}
          {octadeskConversations.length > 0 && !octadeskImportResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {octadeskProgress && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Processando...</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Progress value={(octadeskProgress.processed / octadeskProgress.total) * 100} />
                      <p className="text-sm text-muted-foreground">
                        {octadeskProgress.processed} de {octadeskProgress.total} conversas processadas
                      </p>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-600">✓ {octadeskProgress.success} criados</span>
                        <span className="text-yellow-600">○ {octadeskProgress.skipped} pulados</span>
                        <span className="text-red-600">✗ {octadeskProgress.failed} falhas</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              <div>
                <OctadeskImportConfig
                  selectedCount={octadeskSelectedIds.size}
                  onImport={handleOctadeskImport}
                  isImporting={isOctadeskImporting}
                />
              </div>
            </div>
          )}

          {/* Result */}
          {octadeskImportResult && (
            <div className="space-y-4">
              <KnowledgeImportProgress
                progress={octadeskImportResult.articlesCreated + octadeskImportResult.skipped + octadeskImportResult.failed}
                total={octadeskImportResult.articlesCreated + octadeskImportResult.skipped + octadeskImportResult.failed}
                created={octadeskImportResult.articlesCreated}
                skipped={octadeskImportResult.skipped}
                errors={octadeskImportResult.errors}
                isProcessing={false}
              />
              <Button variant="outline" onClick={handleClearOctadesk}>
                Importar Mais Conversas
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
