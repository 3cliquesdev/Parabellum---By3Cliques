import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import AvatarCropper from "./AvatarCropper";

interface AvatarUploaderProps {
  currentAvatarUrl?: string | null;
  userName: string;
  onFileSelect: (file: File | null) => void;
  uploading?: boolean;
}

export default function AvatarUploader({
  currentAvatarUrl,
  userName,
  onFileSelect,
  uploading = false,
}: AvatarUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!validTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Tipo de arquivo inválido",
        description: "Apenas JPG, PNG e WEBP são permitidos.",
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 2MB.",
      });
      return false;
    }

    return true;
  };

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setPreview(null);
      setRawImageSrc(null);
      onFileSelect(null);
      return;
    }

    if (!validateFile(file)) {
      return;
    }

    // Ler arquivo e abrir cropper
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageSrc(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    // Criar preview do blob recortado
    const croppedUrl = URL.createObjectURL(croppedBlob);
    setPreview(croppedUrl);
    
    // Converter blob para File
    const croppedFile = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
    onFileSelect(croppedFile);
    
    setShowCropper(false);
    setRawImageSrc(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setRawImageSrc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setRawImageSrc(null);
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <div className="space-y-4">
      {/* Avatar Preview */}
      <div className="flex justify-center">
        <Avatar className="h-24 w-24 border-2 border-border">
          {uploading ? (
            <div className="flex items-center justify-center w-full h-full bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <AvatarImage src={preview || undefined} />
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                {getInitials(userName)}
              </AvatarFallback>
            </>
          )}
        </Avatar>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer hover:border-primary/50",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          uploading && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-1">
          <span className="font-medium text-foreground">Arraste uma foto aqui</span>
          <br />
          ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG ou WEBP até 2MB
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileChange(file);
        }}
        disabled={uploading}
      />

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1"
        >
          <Upload className="mr-2 h-4 w-4" />
          Escolher Arquivo
        </Button>
        {preview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={uploading}
          >
            <X className="mr-2 h-4 w-4" />
            Remover
          </Button>
        )}
      </div>
      </div>

      {/* Cropper Modal */}
      {rawImageSrc && (
        <AvatarCropper
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          open={showCropper}
        />
      )}
    </>
  );
}
