import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTicketAttachmentUpload } from "@/hooks/useTicketAttachmentUpload";
import { Upload, FileText, Image as ImageIcon, Film, X, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Attachment {
  url: string;
  type: string;
  name: string;
  uploaded_at?: string;
  uploaded_by?: string;
}

interface TicketAttachmentsProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  readonly?: boolean;
  requireEvidence?: boolean;
}

export function TicketAttachments({ 
  attachments = [], 
  onAttachmentsChange, 
  readonly = false,
  requireEvidence = false 
}: TicketAttachmentsProps) {
  const { uploadFile, uploading, progress } = useTicketAttachmentUpload();
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const result = await uploadFile(file);
    
    if (result) {
      const newAttachment: Attachment = {
        ...result,
        uploaded_at: new Date().toISOString(),
      };
      onAttachmentsChange([...attachments, newAttachment]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (type.startsWith('video/')) return <Film className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const isImage = (type: string) => type.startsWith('image/');

  return (
    <Card className={requireEvidence && attachments.length === 0 ? "border-destructive" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              📎 Arquivos e Evidências
              {requireEvidence && <Badge variant="destructive">Obrigatório</Badge>}
            </CardTitle>
            <CardDescription>
              {requireEvidence 
                ? "Anexe pelo menos 1 evidência (foto do produto, nota fiscal, etc.)"
                : "Fotos, vídeos ou documentos relacionados ao ticket"
              }
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        {!readonly && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input
              type="file"
              id="attachment-upload"
              className="hidden"
              accept="image/*,video/*,.pdf"
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={uploading}
            />
            <label htmlFor="attachment-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                {uploading ? `Uploading... ${progress}%` : "Clique ou arraste arquivos"}
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WEBP, PDF, MP4, MOV (máx 10MB)
              </p>
            </label>
          </div>
        )}

        {/* Attachments Grid */}
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative group border rounded-lg overflow-hidden">
                {isImage(attachment.type) ? (
                  <img 
                    src={attachment.url} 
                    alt={attachment.name}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 bg-muted flex items-center justify-center">
                    {getFileIcon(attachment.type)}
                    <span className="ml-2 text-xs truncate max-w-[120px]">
                      {attachment.name}
                    </span>
                  </div>
                )}
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => window.open(attachment.url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  {!readonly && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* File type badge */}
                <Badge className="absolute top-2 left-2 text-xs">
                  {getFileIcon(attachment.type)}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Warning if no evidence */}
        {requireEvidence && attachments.length === 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
            ⚠️ É obrigatório anexar pelo menos 1 evidência para enviar este ticket ao Financeiro.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
