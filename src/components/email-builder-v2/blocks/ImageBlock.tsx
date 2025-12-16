import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Upload, Link, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { EmailBlock } from "@/types/emailBuilderV2";

interface ImageBlockProps {
  block: EmailBlock;
  isSelected: boolean;
  onUpdate: (content: { src?: string; alt?: string; url?: string }) => void;
  readOnly?: boolean;
}

export function ImageBlock({ block, isSelected, onUpdate, readOnly }: ImageBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempUrl, setTempUrl] = useState(block.content.src || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSave = () => {
    onUpdate({ src: tempUrl });
    setIsEditing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem (JPG, PNG, GIF, WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `email-templates/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('media')
        .upload(fileName, file, {
          cacheControl: '31536000',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      
      setTempUrl(publicUrl);
      onUpdate({ src: publicUrl });
      setIsEditing(false);

      toast({
        title: "Upload concluído",
        description: "Imagem adicionada com sucesso!",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer upload da imagem",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!block.content.src && !readOnly) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed rounded-lg transition-all",
          "bg-muted/50 hover:bg-muted",
          isSelected && "ring-2 ring-primary ring-offset-2"
        )}
        style={{
          padding: block.styles.padding || "32px",
        }}
      >
        <ImageIcon className="h-10 w-10 text-muted-foreground" />
        
        <Tabs defaultValue="upload" className="w-full max-w-sm">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2">
              <Link className="h-4 w-4" />
              URL
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Escolher Imagem
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              JPG, PNG, GIF ou WebP (max 5MB)
            </p>
          </TabsContent>
          
          <TabsContent value="url" className="mt-4 space-y-2">
            <Input
              placeholder="Cole a URL da imagem..."
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <Button size="sm" onClick={handleSave} disabled={!tempUrl} className="w-full">
              Adicionar Imagem
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative group transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        backgroundColor: block.styles.backgroundColor,
        padding: block.styles.padding,
        textAlign: block.styles.textAlign,
      }}
    >
      {block.content.url ? (
        <a href={block.content.url} target="_blank" rel="noopener noreferrer">
          <img
            src={block.content.src}
            alt={block.content.alt || "Email image"}
            className="max-w-full h-auto mx-auto"
            style={{
              borderRadius: block.styles.borderRadius,
            }}
          />
        </a>
      ) : (
        <img
          src={block.content.src}
          alt={block.content.alt || "Email image"}
          className="max-w-full h-auto mx-auto"
          style={{
            borderRadius: block.styles.borderRadius,
          }}
        />
      )}

      {!readOnly && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsEditing(true)}
          >
            Alterar Imagem
          </Button>
        </div>
      )}

      {isEditing && (
        <div className="absolute inset-0 bg-background/95 flex items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-4">
            <Tabs defaultValue="upload">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="url" className="gap-2">
                  <Link className="h-4 w-4" />
                  URL
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Escolher Nova Imagem
                    </>
                  )}
                </Button>
              </TabsContent>
              
              <TabsContent value="url" className="mt-4 space-y-2">
                <Input
                  placeholder="URL da imagem..."
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  autoFocus
                />
                <Button size="sm" onClick={handleSave} className="w-full">
                  Salvar
                </Button>
              </TabsContent>
            </Tabs>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
