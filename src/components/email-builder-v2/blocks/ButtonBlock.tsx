import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Link, Download, Mail, Phone, Upload, Loader2, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { EmailBlock, ButtonAction } from "@/types/emailBuilderV2";

interface ButtonBlockProps {
  block: EmailBlock;
  isSelected: boolean;
  onUpdate: (content: { 
    buttonText?: string; 
    url?: string; 
    buttonAction?: ButtonAction;
    fileUrl?: string;
    email?: string;
    emailSubject?: string;
    phone?: string;
  }) => void;
  onStyleUpdate: (styles: Partial<EmailBlock['styles']>) => void;
  readOnly?: boolean;
}

export function ButtonBlock({ block, isSelected, onUpdate, onStyleUpdate, readOnly }: ButtonBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const buttonAction = block.content.buttonAction || 'link';

  const buttonStyle: React.CSSProperties = {
    backgroundColor: block.styles.backgroundColor || "hsl(var(--primary))",
    color: block.styles.color || "hsl(var(--primary-foreground))",
    padding: block.styles.padding || "12px 24px",
    borderRadius: block.styles.borderRadius || "6px",
    fontSize: block.styles.fontSize || "14px",
    fontWeight: block.styles.fontWeight || "500",
    border: block.styles.border || "none",
    cursor: "pointer",
    display: "inline-block",
    textDecoration: "none",
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `email-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("email-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("email-assets")
        .getPublicUrl(filePath);

      onUpdate({ 
        fileUrl: publicUrl,
        buttonAction: 'download'
      });

      toast({
        title: "Arquivo enviado",
        description: file.name,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Erro ao enviar arquivo",
        description: "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = () => {
    onUpdate({ fileUrl: undefined });
  };

  const getFileNameFromUrl = (url: string) => {
    try {
      const parts = url.split("/");
      return parts[parts.length - 1];
    } catch {
      return "arquivo";
    }
  };

  return (
    <div
      className={cn(
        "py-4 transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        textAlign: block.styles.textAlign || "center",
      }}
    >
      <div className="relative inline-block group">
        {block.content.url && !readOnly ? (
          <a
            href={block.content.url}
            style={buttonStyle}
            onClick={(e) => {
              e.preventDefault();
              setIsEditing(true);
            }}
          >
            {block.content.buttonText || "Clique aqui"}
          </a>
        ) : (
          <button
            style={buttonStyle}
            onClick={() => !readOnly && setIsEditing(true)}
          >
            {block.content.buttonText || "Clique aqui"}
          </button>
        )}

        {!readOnly && (
          <Popover open={isEditing} onOpenChange={setIsEditing}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="center">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Texto do Botão</Label>
                  <Input
                    value={block.content.buttonText || ""}
                    onChange={(e) => onUpdate({ buttonText: e.target.value })}
                    placeholder="Clique aqui"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Ação</Label>
                  <Tabs 
                    value={buttonAction} 
                    onValueChange={(v) => onUpdate({ buttonAction: v as ButtonAction })}
                  >
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="link" className="text-xs">
                        <Link className="h-3 w-3 mr-1" />
                        Link
                      </TabsTrigger>
                      <TabsTrigger value="download" className="text-xs">
                        <Download className="h-3 w-3 mr-1" />
                        Arquivo
                      </TabsTrigger>
                      <TabsTrigger value="email" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        Email
                      </TabsTrigger>
                      <TabsTrigger value="phone" className="text-xs">
                        <Phone className="h-3 w-3 mr-1" />
                        Telefone
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="link" className="space-y-3 mt-3">
                      <div className="space-y-2">
                        <Label>URL do Link</Label>
                        <Input
                          value={block.content.url || ""}
                          onChange={(e) => onUpdate({ url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="download" className="space-y-3 mt-3">
                      <div className="space-y-2">
                        <Label>Arquivo para Download</Label>
                        
                        {block.content.fileUrl ? (
                          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="text-sm flex-1 truncate">
                              {getFileNameFromUrl(block.content.fileUrl)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={handleRemoveFile}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                              "hover:border-primary hover:bg-primary/5"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {isUploading ? (
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Enviando...</span>
                              </div>
                            ) : (
                              <>
                                <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  Clique para enviar arquivo
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  PDF, DOC, XLS, etc (max 10MB)
                                </p>
                              </>
                            )}
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />

                        <div className="space-y-2 pt-2">
                          <Label className="text-xs text-muted-foreground">Ou cole uma URL</Label>
                          <Input
                            value={block.content.fileUrl || ""}
                            onChange={(e) => onUpdate({ fileUrl: e.target.value })}
                            placeholder="https://exemplo.com/arquivo.pdf"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="email" className="space-y-3 mt-3">
                      <div className="space-y-2">
                        <Label>Endereço de Email</Label>
                        <Input
                          type="email"
                          value={block.content.email || ""}
                          onChange={(e) => onUpdate({ email: e.target.value })}
                          placeholder="contato@empresa.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Assunto (opcional)</Label>
                        <Input
                          value={block.content.emailSubject || ""}
                          onChange={(e) => onUpdate({ emailSubject: e.target.value })}
                          placeholder="Assunto do email"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="phone" className="space-y-3 mt-3">
                      <div className="space-y-2">
                        <Label>Número de Telefone</Label>
                        <Input
                          type="tel"
                          value={block.content.phone || ""}
                          onChange={(e) => onUpdate({ phone: e.target.value })}
                          placeholder="+55 11 99999-9999"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>Cor de Fundo</Label>
                    <Input
                      type="color"
                      value={block.styles.backgroundColor || "#2563eb"}
                      onChange={(e) => onStyleUpdate({ backgroundColor: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor do Texto</Label>
                    <Input
                      type="color"
                      value={block.styles.color || "#ffffff"}
                      onChange={(e) => onStyleUpdate({ color: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
