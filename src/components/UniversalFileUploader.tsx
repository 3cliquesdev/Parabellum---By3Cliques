import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, FileSpreadsheet, FileJson } from 'lucide-react';
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

export function UniversalFileUploader({ onDataParsed }: UniversalFileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isJsonFile, setIsJsonFile] = useState(false);
  const { toast } = useToast();

  const validateJsonStructure = (data: unknown): data is JsonKnowledgeItem[] => {
    if (!Array.isArray(data)) {
      return false;
    }
    
    if (data.length === 0) {
      return false;
    }

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

  const showError = useCallback((title: string, description: string) => {
    console.error(`${LOG_PREFIX} Error:`, { title, description });
    toast({
      title,
      description,
      variant: 'destructive',
    });
  }, [toast]);

  const handleFile = useCallback(
    async (selectedFile: File) => {
      const fileType = selectedFile.name.toLowerCase();
      const fileExtension = fileType.split('.').pop() || '';
      
      console.info(`${LOG_PREFIX} Processing file:`, { 
        fileName: selectedFile.name, 
        fileSize: selectedFile.size,
        fileType: fileExtension
      });
      
      try {
        if (fileType.endsWith('.json')) {
          console.info(`${LOG_PREFIX} Parsing JSON file`);
          setIsJsonFile(true);
          
          const text = await selectedFile.text();
          
          let jsonData: unknown;
          try {
            jsonData = JSON.parse(text);
          } catch (parseError) {
            showError('JSON Inválido', 'O arquivo não contém um JSON válido.');
            return;
          }

          if (!validateJsonStructure(jsonData)) {
            showError('Estrutura Inválida', 'O JSON deve ser um array com objetos contendo "input" e "output".');
            return;
          }

          const headers = ['input', 'output', 'category', 'tags'];
          const data = jsonData.map((item) => ({
            input: item.input,
            output: item.output,
            category: item.category || '',
            tags: item.tags || '',
          }));

          console.info(`${LOG_PREFIX} JSON loaded:`, { rowCount: data.length });
          onDataParsed(data, headers);
          setFile(selectedFile);
          
          toast({
            title: 'JSON carregado',
            description: `${data.length} itens encontrados no arquivo.`,
          });

        } else if (fileType.endsWith('.csv')) {
          console.info(`${LOG_PREFIX} Parsing CSV file`);
          setIsJsonFile(false);
          
          // Primeiro, ler o conteúdo para detectar delimitador BR (;) vs padrão (,)
          const textContent = await selectedFile.text();
          const firstLine = textContent.split('\n')[0] || '';
          const semicolonCount = (firstLine.match(/;/g) || []).length;
          const commaCount = (firstLine.match(/,/g) || []).length;
          const detectedDelimiter = semicolonCount > commaCount ? ';' : ',';
          
          console.info(`${LOG_PREFIX} Delimiter detection:`, { 
            semicolonCount, commaCount, detectedDelimiter 
          });

          Papa.parse<Record<string, unknown>>(textContent, {
            header: true,
            skipEmptyLines: true,
            delimiter: detectedDelimiter,
            encoding: 'UTF-8',
            transformHeader: (header: string) => header.trim(),
            transform: (value: string) => value.trim(),
            complete: (results) => {
              console.info(`${LOG_PREFIX} CSV parsed:`, { 
                rowCount: results.data.length,
                delimiter: detectedDelimiter,
                headers: Object.keys(results.data[0] as object || {})
              });
              
              if (results.data.length > 0) {
                const headers = Object.keys(results.data[0] as object);
                // Filtrar linhas completamente vazias
                const cleanData = results.data.filter((row: any) => 
                  headers.some(h => row[h] && String(row[h]).trim() !== '')
                );
                onDataParsed(cleanData, headers);
                setFile(selectedFile);
                
                toast({
                  title: 'CSV carregado',
                  description: `${cleanData.length} linhas encontradas (delimitador: "${detectedDelimiter}").`,
                });
              } else {
                showError('Erro no CSV', 'O arquivo CSV está vazio ou não possui dados válidos.');
              }
            },
            error: (error: Error) => {
              showError('Erro no CSV', error.message);
            },
          });
        } else if (fileType.endsWith('.xlsx') || fileType.endsWith('.xls')) {
          console.info(`${LOG_PREFIX} Parsing Excel file`);
          setIsJsonFile(false);
          
          const rows = await readXlsxFile(selectedFile);
          
          if (rows.length > 0) {
            const headers = rows[0].map(h => String(h));
            
            const data = rows.slice(1).map(row => {
              const obj: Record<string, any> = {};
              headers.forEach((header, index) => {
                obj[header] = row[index];
              });
              return obj;
            });
            
            console.info(`${LOG_PREFIX} Excel loaded:`, { rowCount: data.length });
            onDataParsed(data, headers);
            setFile(selectedFile);
            
            toast({
              title: 'Excel carregado',
              description: `${data.length} linhas encontradas.`,
            });
          } else {
            showError('Erro no Excel', 'O arquivo Excel está vazio.');
          }
        } else {
          showError('Formato Não Suportado', `Apenas arquivos CSV, XLSX, XLS e JSON são aceitos. Formato recebido: .${fileExtension}`);
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Unexpected error:`, error);
        showError('Erro Desconhecido', error instanceof Error ? error.message : 'Erro ao processar arquivo');
      }
    },
    [onDataParsed, toast, showError]
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
    console.info(`${LOG_PREFIX} File cleared`);
    setFile(null);
    setIsJsonFile(false);
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
