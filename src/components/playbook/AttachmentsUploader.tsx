import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  File as FileIcon,
  Image as ImageIcon,
  X,
  Paperclip
} from 'lucide-react';
import { usePlaybookAssetUpload } from '@/hooks/usePlaybookAssetUpload';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface AttachmentsUploaderProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
}

export function AttachmentsUploader({ attachments, onChange }: AttachmentsUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { uploadFile, deleteFile, uploading, progress } = usePlaybookAssetUpload();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/msword', // doc
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      // Validate file type
      if (!acceptedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo não suportado",
          description: `${file.name} não é um tipo de arquivo aceito`,
          variant: "destructive"
        });
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o tamanho máximo de 10MB`,
          variant: "destructive"
        });
        continue;
      }

      // Upload file
      const url = await uploadFile(file);
      if (url) {
        const newAttachment: Attachment = {
          name: file.name,
          url,
          type: file.type,
          size: file.size
        };
        onChange([...attachments, newAttachment]);
      }
    }
  };

  const handleRemove = async (index: number) => {
    const attachment = attachments[index];
    const success = await deleteFile(attachment.url);
    if (success) {
      const updated = attachments.filter((_, i) => i !== index);
      onChange(updated);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
    if (type.includes('word')) return <FileText className="h-8 w-8 text-blue-500" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-8 w-8 text-purple-500" />;
    return <FileIcon className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Materiais de Apoio
      </Label>

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          Escolher Arquivos
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          PDF, Excel, Word, Imagens (máx 10MB cada)
        </p>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground text-center">
            Fazendo upload... {progress}%
          </p>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {attachments.map((attachment, index) => (
            <Card key={index} className="p-3 flex items-center gap-3">
              {getFileIcon(attachment.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
