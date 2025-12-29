import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CSVUploaderProps {
  onDataParsed: (data: any[], headers: string[]) => void;
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
          const headers = results.meta.fields || [];
          if (headers.length === 0 || results.data.length === 0) {
            alert('Arquivo vazio ou formato inválido.');
            setFile(null);
            return;
          }
          onDataParsed(results.data, headers);
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

      const headers = rows[0].map(cell => String(cell || ''));
      const data = rows.slice(1).map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] != null ? String(row[index]) : '';
        });
        return obj;
      });

      onDataParsed(data, headers);
    } catch (error: any) {
      console.error('Erro ao processar Excel:', error);
      
      // Verificar se é arquivo .xls (formato antigo não suportado)
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

    // Arquivo .xls (antigo) - avisar antes de tentar processar
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
