import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, File, Image as ImageIcon, FileAudio, FileVideo, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  onCancel?: () => void;
  isUploading?: boolean;
  progress?: number;
  selectedFile?: File | null;
  disabled?: boolean;
  className?: string;
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
}

const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm", // Chrome/Edge record in WebM - must accept for transcoding
  "audio/opus",
  "video/mp4",
  "video/webm",
];

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function FileDropZone({
  onFileSelect,
  onCancel,
  isUploading = false,
  progress = 0,
  selectedFile,
  disabled = false,
  className,
  maxSize = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
}: FileDropZoneProps) {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === "file-too-large") {
          setError(`Arquivo muito grande. Máximo: ${formatSize(maxSize)}`);
        } else if (rejection.errors[0]?.code === "file-invalid-type") {
          setError("Tipo de arquivo não suportado");
        } else {
          setError(rejection.errors[0]?.message || "Erro ao processar arquivo");
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Generate preview for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setPreview(e.target?.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          setPreview(null);
        }

        onFileSelect(file);
      }
    },
    [onFileSelect, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize,
    multiple: false,
    disabled: disabled || isUploading,
    noClick: !!selectedFile,
    noKeyboard: !!selectedFile,
  });

  const handleCancel = () => {
    setPreview(null);
    setError(null);
    onCancel?.();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
    if (mimeType.startsWith("audio/")) return <FileAudio className="h-5 w-5" />;
    if (mimeType.startsWith("video/")) return <FileVideo className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  // If file is selected, show preview/progress
  if (selectedFile) {
    return (
      <div className={cn("p-3 rounded-xl border border-border bg-background", className)}>
        <div className="flex items-center gap-3">
          {/* Preview or Icon */}
          <div className="shrink-0">
            {preview ? (
              <img
                src={preview}
                alt={selectedFile.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                {getFileIcon(selectedFile.type)}
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(selectedFile.size)}
            </p>
            
            {/* Progress Bar */}
            {isUploading && (
              <Progress value={progress} className="h-1.5 mt-2" />
            )}
          </div>

          {/* Cancel Button */}
          {!isUploading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="shrink-0 h-8 w-8"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isUploading && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Enviando... {progress}%
          </p>
        )}
      </div>
    );
  }

  // Drop Zone UI
  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        disabled && "opacity-50 cursor-not-allowed",
        error && "border-destructive",
        className
      )}
      role="button"
      aria-label="Upload file"
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className={cn(
            "p-3 rounded-full transition-colors",
            isDragActive ? "bg-primary/10" : "bg-muted"
          )}
        >
          <Upload
            className={cn(
              "h-6 w-6",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>

        <div>
          <p className="text-sm font-medium">
            {isDragActive ? "Solte o arquivo aqui" : "Arraste um arquivo ou clique"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Imagens, PDFs, áudios ou vídeos (máx. {formatSize(maxSize)})
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-destructive text-xs mt-1">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact version for inline use in composer
export function FileDropZoneCompact({
  onFileSelect,
  disabled = false,
  className,
}: {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  className?: string;
}) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: DEFAULT_ACCEPTED_TYPES.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: DEFAULT_MAX_SIZE,
    multiple: false,
    disabled,
    noDrag: false,
  });

  return (
    <div {...getRootProps()} className={className}>
      <input {...getInputProps()} />
      {isDragActive && (
        <div className="fixed inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-background border-2 border-dashed border-primary rounded-2xl p-8 shadow-lg">
            <Upload className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="text-lg font-medium text-center">Solte o arquivo aqui</p>
          </div>
        </div>
      )}
    </div>
  );
}
