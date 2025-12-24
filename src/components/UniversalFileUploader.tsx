import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, FileSpreadsheet, FileJson, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LOG_PREFIX = '[UniversalFileUploader]';

interface UniversalFileUploaderProps {
  onDataParsed: (data: any[], headers: string[]) => void;
}

interface JsonKnowledgeItem {
  input: string;
  output: string;
  category?: string;
  tags?: string;
}

interface ParseError {
  type: 'json_parse' | 'json_structure' | 'csv_parse' | 'excel_parse' | 'unsupported_format' | 'unknown';
  message: string;
  details?: string;
}

export function UniversalFileUploader({ onDataParsed }: UniversalFileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isJsonFile, setIsJsonFile] = useState(false);
  const [lastError, setLastError] = useState<ParseError | null>(null);
  const { toast } = useToast();

  const logInfo = (message: string, data?: Record<string, unknown>) => {
    console.info(`${LOG_PREFIX} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  };

  const logError = (message: string, error?: unknown, context?: Record<string, unknown>) => {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { raw: String(error) };
    console.error(`${LOG_PREFIX} ${message}`, { error: errorDetails, context });
  };

  const handleError = (parseError: ParseError) => {
    setLastError(parseError);
    logError(parseError.message, null, { type: parseError.type, details: parseError.details });
    
    toast({
      title: getErrorTitle(parseError.type),
      description: parseError.message,
      variant: 'destructive',
    });
  };

  const getErrorTitle = (type: ParseError['type']): string => {
    const titles: Record<ParseError['type'], string> = {
      json_parse: 'JSON Inválido',
      json_structure: 'Estrutura Inválida',
      csv_parse: 'Erro no CSV',
      excel_parse: 'Erro no Excel',
      unsupported_format: 'Formato Não Suportado',
      unknown: 'Erro Desconhecido',
    };
    return titles[type];
  };

  const clearError = () => setLastError(null);

  const validateJsonStructure = (data: unknown): data is JsonKnowledgeItem[] => {
    if (!Array.isArray(data)) {
      return false;
    }
    
    if (data.length === 0) {
      return false;
    }

    // Check if all items have required fields
    return data.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'input' in item &&
        'output' in item &&
        typeof item.input === 'string' &&
        typeof item.output === 'string'
    );
  };

  const handleFile = useCallback(
    async (selectedFile: File) => {
      const fileType = selectedFile.name.toLowerCase();
      const fileExtension = fileType.split('.').pop() || '';
      
      logInfo('Processing file', { 
        fileName: selectedFile.name, 
        fileSize: selectedFile.size,
        fileType: fileExtension,
        timestamp: new Date().toISOString()
      });

      clearError();
      
      try {
        if (fileType.endsWith('.json')) {
          logInfo('Parsing JSON file');
          setIsJsonFile(true);
          
          const text = await selectedFile.text();
          logInfo('JSON file read', { textLength: text.length });
          
          let jsonData: unknown;
          try {
            jsonData = JSON.parse(text);
            logInfo('JSON parsed successfully', { 
              isArray: Array.isArray(jsonData),
              itemCount: Array.isArray(jsonData) ? jsonData.length : 'N/A'
            });
          } catch (parseError) {
            handleError({
              type: 'json_parse',
              message: 'O arquivo não contém um JSON válido.',
              details: parseError instanceof Error ? parseError.message : 'Parse error'
            });
            return;
          }

          if (!validateJsonStructure(jsonData)) {
            const sampleItem = Array.isArray(jsonData) && jsonData[0] 
              ? Object.keys(jsonData[0] as object).join(', ') 
              : 'não é array';
            
            handleError({
              type: 'json_structure',
              message: 'O JSON deve ser um array com objetos contendo "input" e "output".',
              details: `Estrutura encontrada: ${sampleItem}`
            });
            return;
          }

          const headers = ['input', 'output', 'category', 'tags'];
          const data = jsonData.map((item) => ({
            input: item.input,
            output: item.output,
            category: item.category || '',
            tags: item.tags || '',
          }));

          logInfo('JSON data converted', { 
            rowCount: data.length, 
            headers,
            sampleRow: data[0] ? { 
              inputLength: data[0].input?.length,
              outputLength: data[0].output?.length 
            } : null
          });

          onDataParsed(data, headers);
          setFile(selectedFile);
          
          toast({
            title: 'JSON carregado',
            description: `${data.length} itens encontrados no arquivo.`,
          });

        } else if (fileType.endsWith('.csv')) {
          logInfo('Parsing CSV file');
          setIsJsonFile(false);
          
          Papa.parse<Record<string, unknown>>(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              logInfo('CSV parsed', { 
                rowCount: results.data.length,
                errors: results.errors?.length || 0,
                meta: results.meta
              });
              
              if (results.errors && results.errors.length > 0) {
                logError('CSV parsing had warnings', null, { errors: results.errors });
              }
              
              if (results.data.length > 0) {
                const headers = Object.keys(results.data[0] as object);
                logInfo('CSV headers detected', { headers });
                onDataParsed(results.data, headers);
                setFile(selectedFile);
                
                toast({
                  title: 'CSV carregado',
                  description: `${results.data.length} linhas encontradas.`,
                });
              } else {
                handleError({
                  type: 'csv_parse',
                  message: 'O arquivo CSV está vazio ou não possui dados válidos.',
                });
              }
            },
            error: (error: Error) => {
              handleError({
                type: 'csv_parse',
                message: error.message,
              });
            },
          });
        } else if (fileType.endsWith('.xlsx') || fileType.endsWith('.xls')) {
          logInfo('Parsing Excel file');
          setIsJsonFile(false);
          
          const rows = await readXlsxFile(selectedFile);
          logInfo('Excel parsed', { totalRows: rows.length });
          
          if (rows.length > 0) {
            const headers = rows[0].map(h => String(h));
            logInfo('Excel headers detected', { headers });
            
            const data = rows.slice(1).map(row => {
              const obj: Record<string, any> = {};
              headers.forEach((header, index) => {
                obj[header] = row[index];
              });
              return obj;
            });
            
            logInfo('Excel data converted', { 
              rowCount: data.length,
              columnCount: headers.length 
            });
            
            onDataParsed(data, headers);
            setFile(selectedFile);
            
            toast({
              title: 'Excel carregado',
              description: `${data.length} linhas encontradas.`,
            });
          } else {
            handleError({
              type: 'excel_parse',
              message: 'O arquivo Excel está vazio.',
            });
          }
        } else {
          handleError({
            type: 'unsupported_format',
            message: 'Apenas arquivos CSV, XLSX, XLS e JSON são aceitos.',
            details: `Formato recebido: .${fileExtension}`
          });
        }
      } catch (error) {
        handleError({
          type: 'unknown',
          message: error instanceof Error ? error.message : 'Erro desconhecido ao processar arquivo',
          details: error instanceof Error ? error.stack : undefined
        });
      }
    },
    [onDataParsed, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
  );

  const clearFile = useCallback(() => {
    logInfo('File cleared');
    setFile(null);
    setIsJsonFile(false);
    setLastError(null);
    onDataParsed([], []);
  }, [onDataParsed]);

  if (file) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isJsonFile ? (
                <FileJson className="h-8 w-8 text-primary" />
              ) : (
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              )}
              <div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-lg transition-colors ${
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="p-12 text-center">
        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Arraste seu arquivo aqui
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          ou clique para selecionar
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload">
          <Button variant="outline" asChild>
            <span>Selecionar Arquivo</span>
          </Button>
        </label>
        <p className="text-xs text-muted-foreground mt-4">
          Formatos aceitos: CSV, XLSX, XLS, JSON
        </p>
      </div>
    </div>
  );
}
