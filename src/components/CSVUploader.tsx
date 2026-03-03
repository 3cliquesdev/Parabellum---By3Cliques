import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CSVUploaderProps {
  onDataParsed: (data: any[], headers: string[]) => void;
}

/**
 * Sanitiza um header: trim, remove caracteres invisíveis (BOM, ZWNBSP, etc.)
 */
function sanitizeHeader(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // zero-width chars, BOM, NBSP
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Garante unicidade dos headers (adiciona sufixo _2, _3 em duplicados)
 */
function ensureUniqueHeaders(headers: string[]): string[] {
  const seen: Record<string, number> = {};
  return headers.map((h) => {
    if (!h) return h;
    const lower = h.toLowerCase();
    if (seen[lower] !== undefined) {
      seen[lower]++;
      return `${h}_${seen[lower]}`;
    }
    seen[lower] = 1;
    return h;
  });
}

/**
 * Dado um array de linhas (array de arrays), encontra a melhor linha de cabeçalho
 * nas primeiras 10 linhas: a que tiver mais células com texto não-vazio.
 * Retorna o índice da linha.
 */
function findBestHeaderRow(rows: any[][], maxScan = 10): number {
  let bestIdx = 0;
  let bestCount = 0;

  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row) continue;
    const filled = row.filter(cell => cell != null && String(cell).trim() !== '').length;
    if (filled > bestCount) {
      bestCount = filled;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Processa headers brutos:
 * 1. Sanitiza
 * 2. Gera fallback para vazios (coluna_1, coluna_2…)
 * 3. Remove colunas totalmente vazias nos dados
 * 4. Garante unicidade
 */
function processHeaders(rawHeaders: string[], dataRows?: Record<string, string>[]): string[] {
  let headers = rawHeaders.map((h, i) => {
    const clean = sanitizeHeader(String(h ?? ''));
    return clean || `coluna_${i + 1}`;
  });

  // Remover colunas que são todas vazias nos dados (se temos dados)
  if (dataRows && dataRows.length > 0) {
    headers = headers.filter(h => {
      // Verificar se pelo menos 1 linha tem dado nesta coluna
      return dataRows.some(row => {
        const val = row[h];
        return val != null && String(val).trim() !== '';
      });
    });
  }

  return ensureUniqueHeaders(headers);
}

export function CSVUploader({ onDataParsed }: CSVUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target?.result as string;
      
      // Remover BOM se existir
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }

      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        delimiter: '', // Auto-detectar delimitador
        complete: (results) => {
          const rawHeaders = results.meta.fields || [];
          if (rawHeaders.length === 0 || results.data.length === 0) {
            alert('Arquivo vazio ou formato inválido.');
            setFile(null);
            return;
          }

          // Sanitizar headers
          const sanitizedHeaders = rawHeaders.map(h => sanitizeHeader(h));
          
          // Reconstruir dados com headers sanitizados
          const data = (results.data as any[]).map(row => {
            const newRow: Record<string, string> = {};
            rawHeaders.forEach((rawH, i) => {
              const cleanH = sanitizedHeaders[i] || `coluna_${i + 1}`;
              newRow[cleanH] = row[rawH] ?? '';
            });
            return newRow;
          });

          const finalHeaders = processHeaders(sanitizedHeaders, data);
          
          console.log('[CSVUploader] CSV parsed headers:', finalHeaders, '| total colunas:', finalHeaders.length, '| total linhas:', data.length);
          
          if (finalHeaders.length === 0) {
            alert('Não encontramos cabeçalhos válidos no CSV. Verifique se a primeira linha contém os nomes das colunas.');
            setFile(null);
            return;
          }

          onDataParsed(data, finalHeaders);
        },
        error: (error) => {
          console.error('Erro ao processar CSV:', error);
          alert('Erro ao processar arquivo CSV');
          setFile(null);
        },
      });
    };
    reader.onerror = () => {
      alert('Erro ao ler arquivo');
      setFile(null);
    };
    reader.readAsText(file, 'UTF-8');
  }, [onDataParsed]);

  const parseExcel = useCallback(async (file: File) => {
    try {
      const rows = await readXlsxFile(file);
      if (rows.length < 2) {
        alert('Planilha vazia ou sem dados.');
        setFile(null);
        return;
      }

      // Detectar melhor linha de header (não assumir rows[0])
      const headerIdx = findBestHeaderRow(rows);
      console.log('[CSVUploader] Excel: melhor linha de header detectada no índice', headerIdx, '| conteúdo:', rows[headerIdx]?.map(c => String(c ?? '')));

      const rawHeaders = rows[headerIdx].map(cell => String(cell ?? ''));
      const sanitizedHeaders = rawHeaders.map(h => sanitizeHeader(h));

      // Dados = tudo após a linha de header
      const dataRows = rows.slice(headerIdx + 1);

      const data = dataRows.map(row => {
        const obj: Record<string, string> = {};
        sanitizedHeaders.forEach((header, index) => {
          const key = header || `coluna_${index + 1}`;
          obj[key] = row[index] != null ? String(row[index]) : '';
        });
        return obj;
      });

      const finalHeaders = processHeaders(
        sanitizedHeaders.map((h, i) => h || `coluna_${i + 1}`),
        data
      );

      console.log('[CSVUploader] Excel parsed headers:', finalHeaders, '| total colunas:', finalHeaders.length, '| total linhas:', data.length);

      if (finalHeaders.length === 0) {
        alert('Não encontramos cabeçalhos válidos na planilha. Verifique se há uma linha com nomes de colunas.');
        setFile(null);
        return;
      }

      onDataParsed(data, finalHeaders);
    } catch (error: any) {
      console.error('Erro ao processar Excel:', error);
      
      if (error?.message?.includes('invalid zip') || error?.code === 13) {
        alert('Formato .xls (Excel 97-2003) não suportado.\n\nPor favor, abra o arquivo no Excel e salve como:\n• .xlsx (Excel moderno)\n• .csv (separado por ponto-e-vírgula)');
      } else {
        alert('Erro ao processar planilha Excel. Verifique se o arquivo não está corrompido.');
      }
      setFile(null);
    }
  }, [onDataParsed]);

  const handleFile = useCallback((selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || fileName.endsWith('.txt');
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isExcel) {
      alert('Por favor, selecione um arquivo CSV ou Excel (.xlsx)');
      return;
    }

    if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      alert('Formato .xls (Excel 97-2003) não suportado.\n\nPor favor, abra o arquivo no Excel e salve como:\n• .xlsx (Excel moderno)\n• .csv (separado por ponto-e-vírgula)');
      return;
    }

    setFile(selectedFile);

    if (isExcel) {
      parseExcel(selectedFile);
    } else {
      parseCSV(selectedFile);
    }
  }, [parseCSV, parseExcel]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, [handleFile]);

  const clearFile = useCallback(() => {
    setFile(null);
    onDataParsed([], []);
  }, [onDataParsed]);

  return (
    <Card className="p-6">
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Arraste sua planilha aqui</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Aceita arquivos Excel (.xlsx) ou CSV
          </p>
          <label htmlFor="file-upload">
            <Button variant="outline" className="cursor-pointer" asChild>
              <span>Selecionar Arquivo</span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".csv,.xlsx,.txt"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearFile}
            className="text-destructive hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
