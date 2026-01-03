import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, File, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormFileUploadProps {
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  accept?: string;
  maxSizeMb?: number;
  maxFiles?: number;
  inputStyles?: React.CSSProperties;
  settings?: any;
}

export interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

export function FormFileUpload({
  value = [],
  onChange,
  accept = "image/*,.pdf,.doc,.docx",
  maxSizeMb = 10,
  maxFiles = 5,
  inputStyles,
  settings,
}: FormFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    try {
      // Validate size
      if (file.size > maxSizeMb * 1024 * 1024) {
        throw new Error(`Arquivo muito grande. Máximo: ${maxSizeMb}MB`);
      }

      // Generate unique filename
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { data, error } = await supabase.storage
        .from('form-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('form-attachments')
        .getPublicUrl(data.path);

      return {
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
      };
    } catch (err: any) {
      console.error('Upload error:', err);
      throw err;
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (value.length + acceptedFiles.length > maxFiles) {
      setError(`Máximo de ${maxFiles} arquivos permitidos`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const uploadedFiles: UploadedFile[] = [];
      
      for (const file of acceptedFiles) {
        const uploaded = await uploadFile(file);
        if (uploaded) {
          uploadedFiles.push(uploaded);
        }
      }

      onChange([...value, ...uploadedFiles]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [value, onChange, maxFiles, maxSizeMb]);

  const removeFile = (index: number) => {
    const newFiles = [...value];
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { 'application/*': accept.split(',') } : undefined,
    maxFiles: maxFiles - value.length,
    disabled: uploading || value.length >= maxFiles,
  });

  const isImage = (type: string) => type.startsWith('image/');

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          ${value.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{
          backgroundColor: inputStyles?.backgroundColor || 'transparent',
          color: inputStyles?.color || 'inherit',
        }}
      >
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Enviando arquivo...</p>
          </div>
        ) : isDragActive ? (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-primary" />
            <p>Solte o arquivo aqui...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 opacity-50" />
            <p className="font-medium">
              {value.length >= maxFiles 
                ? 'Limite de arquivos atingido' 
                : 'Arraste arquivos ou clique para selecionar'}
            </p>
            <p className="text-sm opacity-60">
              Máx: {maxSizeMb}MB por arquivo, até {maxFiles} arquivos
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Uploaded files preview */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.map((file, index) => (
            <div 
              key={index}
              className="relative group rounded-lg overflow-hidden border"
              style={{ 
                backgroundColor: inputStyles?.backgroundColor,
                borderColor: inputStyles?.borderColor,
              }}
            >
              {isImage(file.type) ? (
                <img 
                  src={file.url} 
                  alt={file.name}
                  className="w-full h-24 object-cover"
                />
              ) : (
                <div className="w-full h-24 flex flex-col items-center justify-center gap-1 p-2">
                  <File className="h-8 w-8 opacity-50" />
                  <span className="text-xs truncate max-w-full px-2">{file.name}</span>
                </div>
              )}
              
              {/* Remove button */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
