import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseOctadeskExport, OctadeskConversation } from '@/utils/octadeskParser';

interface OctadeskFileUploaderProps {
  onDataParsed: (conversations: OctadeskConversation[]) => void;
  isLoading?: boolean;
}

export function OctadeskFileUploader({ onDataParsed, isLoading }: OctadeskFileUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setParseSuccess(false);
    
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const text = await file.text();
      let data: unknown[];

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Arquivo JSON inválido. Verifique o formato do arquivo.');
      }

      if (!Array.isArray(data)) {
        throw new Error('O arquivo deve conter um array de conversas.');
      }

      if (data.length === 0) {
        throw new Error('O arquivo não contém nenhuma conversa.');
      }

      const conversations = parseOctadeskExport(data);
      
      if (conversations.length === 0) {
        throw new Error('Nenhuma conversa válida encontrada no arquivo.');
      }

      setParseSuccess(true);
      onDataParsed(conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
      setFileName(null);
    }
  }, [onDataParsed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  return (
    <div className="space-y-4">
      <Card 
        {...getRootProps()} 
        className={`border-2 border-dashed cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-primary bg-primary/5' 
            : parseSuccess 
              ? 'border-green-500 bg-green-500/5' 
              : 'border-muted-foreground/25 hover:border-primary/50'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <CardContent className="flex flex-col items-center justify-center py-10">
          <input {...getInputProps()} />
          
          {parseSuccess ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium text-green-700">Arquivo carregado com sucesso!</p>
              <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
            </>
          ) : (
            <>
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                {isDragActive ? (
                  <FileJson className="h-8 w-8 text-primary" />
                ) : (
                  <Upload className="h-8 w-8 text-primary" />
                )}
              </div>
              <p className="text-lg font-medium">
                {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o arquivo JSON do Octadesk'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Aceita apenas arquivos .json exportados do Octadesk (MongoDB export)
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
