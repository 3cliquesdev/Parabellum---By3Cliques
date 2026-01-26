import { useState, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import { MacrosPopover } from "@/components/MacrosPopover";
import { FileDropZone } from "./FileDropZone";
import { AudioRecorder } from "./AudioRecorder";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useSendMessage } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getFreshMediaUrl } from "@/hooks/useMediaUrls";
import {
  Send,
  StickyNote,
  MessageCircle,
  AlertTriangle,
  Paperclip,
  Mic,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export type MessageMode = "public" | "internal";

interface PendingAttachment {
  file: File;
  preview?: string;
  uploadedMedia?: {
    id: string;
    url: string;
    mimeType: string;
    filename: string;
  };
  error?: string;
  isRetrying?: boolean;
}

export interface SuperComposerProps {
  conversationId: string;
  isDisabled?: boolean;
  whatsappInstanceId?: string | null;
  whatsappMetaInstanceId?: string | null;
  whatsappProvider?: string | null;
  contactPhone?: string | null;
}

export function SuperComposer({
  conversationId,
  isDisabled = false,
  whatsappInstanceId,
  whatsappMetaInstanceId,
  whatsappProvider,
  contactPhone,
}: SuperComposerProps) {
  const [message, setMessage] = useState("");
  const [messageMode, setMessageMode] = useState<MessageMode>("public");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { user } = useAuth();
  const sendMessage = useSendMessage();

  const { upload, isUploading, progress } = useMediaUpload({
    conversationId,
    onSuccess: (media) => {
      setPendingAttachments((prev) =>
        prev.map((att) =>
          att.file.name === media.filename
            ? {
                ...att,
                uploadedMedia: {
                  id: media.id,
                  url: media.url || "",
                  mimeType: media.mimeType,
                  filename: media.filename,
                },
                error: undefined,
                isRetrying: false,
              }
            : att
        )
      );
    },
    onError: (error, filename) => {
      console.error('[SuperComposer] Upload error for', filename, ':', error);
      setPendingAttachments((prev) =>
        prev.map((att) =>
          att.file.name === filename
            ? { ...att, error: error, isRetrying: false }
            : att
        )
      );
    },
  });

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMacroSelect = (content: string) => {
    setMessage(content);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async (file: File) => {
    let preview: string | undefined;
    if (file.type.startsWith("image/")) {
      preview = URL.createObjectURL(file);
    }

    setPendingAttachments((prev) => [...prev, { file, preview }]);
    setShowAttachmentPicker(false);

    await upload(file);
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => {
      const attachment = prev[index];
      if (attachment.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleRetryUpload = async (index: number) => {
    const attachment = pendingAttachments[index];
    if (!attachment) return;

    // Marcar como retrying
    setPendingAttachments((prev) =>
      prev.map((att, i) =>
        i === index ? { ...att, isRetrying: true, error: undefined } : att
      )
    );

    await upload(attachment.file);
  };

  const handleAudioComplete = async (audioFile: File) => {
    setIsRecordingAudio(false);
    setPendingAttachments((prev) => [...prev, { file: audioFile }]);
    await upload(audioFile);
  };

  // Helper para detectar tipo de mídia (Evolution API)
  const detectMediaType = (mimeType: string): 'image' | 'audio' | 'video' | 'document' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  };

  // Helper para detectar tipo de mídia (Meta API)
  const detectMetaMediaType = (mimeType: string): 'image' | 'audio' | 'video' | 'document' | 'sticker' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  };

  const handleSend = async () => {
    const hasContent = message.trim() || pendingAttachments.some((a) => a.uploadedMedia);
    if (!hasContent || !conversationId) return;

    // Verificar se há anexos com erro
    const hasErrors = pendingAttachments.some(a => a.error);
    if (hasErrors) {
      toast({
        title: "Erro nos anexos",
        description: "Alguns anexos falharam. Remova ou tente novamente antes de enviar.",
        variant: "destructive",
      });
      return;
    }

    const isInternal = messageMode === "internal";
    const messageContent = message.trim();
    
    // Coletar IDs de anexos prontos
    const uploadedAttachments = pendingAttachments
      .filter(a => a.uploadedMedia)
      .map(a => a.uploadedMedia!);

    try {
      let sentMessageId: string | null = null;

      // Internal note - just save to database
      if (isInternal) {
        const result = await sendMessage.mutateAsync({
          conversation_id: conversationId,
          content: messageContent,
          sender_type: "user",
          sender_id: user?.id || null,
          status: 'sent',
          is_internal: true,
        });
        sentMessageId = result?.id || null;
      } else if (whatsappProvider === 'meta' && whatsappMetaInstanceId && contactPhone) {
        // Meta WhatsApp Cloud API
        try {
          console.log('[SuperComposer] Enviando via Meta WhatsApp Cloud API');
          
          if (uploadedAttachments.length > 0) {
            // Enviar mídia via Meta API
            for (let i = 0; i < uploadedAttachments.length; i++) {
              const att = uploadedAttachments[i];
              console.log('[SuperComposer] Enviando mídia Meta WhatsApp:', att.mimeType);
              
              const freshUrl = await getFreshMediaUrl(att.id);
              
              if (!freshUrl) {
                console.error('[SuperComposer] Falha ao obter URL fresca para:', att.id);
                toast({
                  title: "Erro ao enviar mídia",
                  description: `Não foi possível preparar ${att.filename} para envio.`,
                  variant: "destructive",
                });
                continue;
              }
              
              const { error: metaMediaError } = await supabase.functions.invoke('send-meta-whatsapp', {
                body: {
                  instance_id: whatsappMetaInstanceId,
                  phone_number: contactPhone,
                  message: i === 0 ? messageContent : '',
                  media: {
                    type: detectMetaMediaType(att.mimeType),
                    url: freshUrl,
                    caption: i === 0 ? messageContent : undefined,
                    filename: att.filename,
                  },
                  conversation_id: conversationId,
                }
              });

              if (metaMediaError) {
                throw new Error(metaMediaError.message || 'Failed to send Meta WhatsApp media');
              }
            }
          } else if (messageContent) {
            // Apenas texto
            const { error: metaError } = await supabase.functions.invoke('send-meta-whatsapp', {
              body: {
                instance_id: whatsappMetaInstanceId,
                phone_number: contactPhone,
                message: messageContent,
                conversation_id: conversationId,
              }
            });

            if (metaError) {
              throw new Error(metaError.message || 'Failed to send Meta WhatsApp message');
            }
          }

          const result = await sendMessage.mutateAsync({
            conversation_id: conversationId,
            content: messageContent || (uploadedAttachments.length > 0 ? '📎 Mídia enviada' : ''),
            sender_type: "user",
            sender_id: user?.id || null,
            status: 'sent',
          });
          sentMessageId = result?.id || null;
        } catch (error) {
          console.error('[SuperComposer] Meta WhatsApp send failed:', error);
          
          const result = await sendMessage.mutateAsync({
            conversation_id: conversationId,
            content: messageContent || '📎 Mídia',
            sender_type: "user",
            sender_id: user?.id || null,
            status: 'failed',
            delivery_error: error instanceof Error ? error.message : 'Unknown error',
          });
          sentMessageId = result?.id || null;
        }
      } else if (whatsappInstanceId && contactPhone) {
        // Evolution API (legacy)
        try {
          // Se tem anexos, enviar primeiro como mídia
          if (uploadedAttachments.length > 0) {
            for (let i = 0; i < uploadedAttachments.length; i++) {
              const att = uploadedAttachments[i];
              console.log('[SuperComposer] Enviando mídia WhatsApp (Evolution):', att.mimeType);
              
              const freshUrl = await getFreshMediaUrl(att.id);
              
              if (!freshUrl) {
                console.error('[SuperComposer] Falha ao obter URL fresca para:', att.id);
                toast({
                  title: "Erro ao enviar mídia",
                  description: `Não foi possível preparar ${att.filename} para envio.`,
                  variant: "destructive",
                });
                continue;
              }
              
              const { error: mediaError } = await supabase.functions.invoke('send-whatsapp-message', {
                body: {
                  instance_id: whatsappInstanceId,
                  phone_number: contactPhone,
                  message: i === 0 ? messageContent : '',
                  media_url: freshUrl,
                  media_type: detectMediaType(att.mimeType),
                  media_filename: att.filename,
                  delay: 1000,
                }
              });

              if (mediaError) {
                throw new Error(mediaError.message || 'Failed to send WhatsApp media');
              }
            }
          } else if (messageContent) {
            // Apenas texto
            const { error: evolutionError } = await supabase.functions.invoke('send-whatsapp-message', {
              body: {
                instance_id: whatsappInstanceId,
                phone_number: contactPhone,
                message: messageContent,
                delay: 1000,
              }
            });

            if (evolutionError) {
              throw new Error(evolutionError.message || 'Failed to send WhatsApp message');
            }
          }

          const result = await sendMessage.mutateAsync({
            conversation_id: conversationId,
            content: messageContent || (uploadedAttachments.length > 0 ? '📎 Mídia enviada' : ''),
            sender_type: "user",
            sender_id: user?.id || null,
            status: 'sent',
          });
          sentMessageId = result?.id || null;
        } catch (error) {
          console.error('[SuperComposer] WhatsApp (Evolution) send failed:', error);
          
          const result = await sendMessage.mutateAsync({
            conversation_id: conversationId,
            content: messageContent || '📎 Mídia',
            sender_type: "user",
            sender_id: user?.id || null,
            status: 'failed',
            delivery_error: error instanceof Error ? error.message : 'Unknown error',
          });
          sentMessageId = result?.id || null;
        }
      } else {
        // Web chat - save directly
        const result = await sendMessage.mutateAsync({
          conversation_id: conversationId,
          content: messageContent || (uploadedAttachments.length > 0 ? '📎 Anexo' : ''),
          sender_type: "user",
          sender_id: user?.id || null,
          status: 'sent',
        });
        sentMessageId = result?.id || null;
      }

      // 🔗 VINCULAR ANEXOS À MENSAGEM
      if (sentMessageId && uploadedAttachments.length > 0) {
        const attachmentIds = uploadedAttachments.map(a => a.id);
        console.log('[SuperComposer] Vinculando anexos à mensagem:', sentMessageId, attachmentIds);
        
        const { error: linkError } = await supabase
          .from('media_attachments')
          .update({ message_id: sentMessageId })
          .in('id', attachmentIds);
        
        if (linkError) {
          console.error('[SuperComposer] Erro ao vincular anexos:', linkError);
        }
      }

      // Clear state
      setMessage("");
      pendingAttachments.forEach((att) => {
        if (att.preview) URL.revokeObjectURL(att.preview);
      });
      setPendingAttachments([]);
    } catch (error) {
      console.error('[SuperComposer] Send failed:', error);
    }
  };

  const isInternal = messageMode === "internal";
  const hasAttachments = pendingAttachments.length > 0;
  const hasErrors = pendingAttachments.some(a => a.error);
  const allUploaded = pendingAttachments.every((a) => a.uploadedMedia || a.error);
  const isSending = sendMessage.isPending;
  const canSend = (message.trim() || (hasAttachments && allUploaded && !hasErrors)) && !isUploading;

  return (
    <div className="flex-none bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-slate-200 dark:border-zinc-800">
      {/* Tabs */}
      <div className="px-4 pt-3 flex items-center justify-between gap-3">
        <Tabs
          value={messageMode}
          onValueChange={(v) => setMessageMode(v as MessageMode)}
        >
          <TabsList className="h-8 p-0.5 bg-slate-100 dark:bg-zinc-800">
            <TabsTrigger
              value="public"
              className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Mensagem
            </TabsTrigger>
            <TabsTrigger
              value="internal"
              className={cn(
                "h-7 px-3 gap-1.5 text-xs",
                "data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-800",
                "dark:data-[state=active]:bg-yellow-900/50 dark:data-[state=active]:text-yellow-200"
              )}
            >
              <StickyNote className="h-3.5 w-3.5" />
              Nota Interna
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Internal Note Warning */}
      {isInternal && (
        <div className="mx-4 mt-2 flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 px-3 py-1.5 rounded-md">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Esta mensagem é visível apenas para a equipe interna</span>
        </div>
      )}

      {/* Pending Attachments Preview */}
      {hasAttachments && (
        <div className="px-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {pendingAttachments.map((att, index) => (
              <div
                key={index}
                className="relative group rounded-lg border border-border overflow-hidden"
              >
                {/* Estado de erro */}
                {att.error ? (
                  <div className="h-16 w-20 flex flex-col items-center justify-center bg-destructive/10 p-2">
                    <AlertCircle className="h-4 w-4 text-destructive mb-1" />
                    <span className="text-[10px] text-destructive text-center truncate w-full">Erro</span>
                  </div>
                ) : att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.file.name}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 flex items-center justify-center bg-muted">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                
                {/* Upload Progress Overlay */}
                {!att.uploadedMedia && !att.error && !att.isRetrying && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white text-xs font-medium">
                      {Math.round(progress?.percentage || 0)}%
                    </div>
                  </div>
                )}

                {/* Retrying Overlay */}
                {att.isRetrying && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}

                {/* Retry Button (for errors) */}
                {att.error && !att.isRetrying && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-0.5 left-0.5 h-6 w-6 bg-white/90 hover:bg-white"
                    onClick={() => handleRetryUpload(index)}
                  >
                    <RefreshCw className="h-3 w-3 text-destructive" />
                  </Button>
                )}

                {/* Remove Button */}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveAttachment(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 pt-3">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          {isRecordingAudio ? (
            <AudioRecorder
              onRecordingComplete={handleAudioComplete}
              onCancel={() => setIsRecordingAudio(false)}
              disabled={isDisabled}
            />
          ) : (
            <>
              {/* Macros Button */}
              <MacrosPopover
                onSelectMacro={handleMacroSelect}
                disabled={isDisabled || isSending}
              />

              {/* Audio Recording Button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => setIsRecordingAudio(true)}
                disabled={isDisabled || isSending}
              >
                <Mic className="h-5 w-5 text-muted-foreground" />
              </Button>

              {/* Attachment Button */}
              <Popover open={showAttachmentPicker} onOpenChange={setShowAttachmentPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    disabled={isDisabled || isSending}
                  >
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                  <FileDropZone
                    onFileSelect={handleFileSelect}
                    disabled={isUploading}
                  />
                </PopoverContent>
              </Popover>

              {/* Textarea with Slash Commands */}
              <SlashCommandMenu value={message} onChange={setMessage}>
                <Textarea
                  ref={textareaRef}
                  placeholder={isDisabled ? "Conversa encerrada" : "Digite sua mensagem ou / para macros..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isSending || isDisabled}
                  rows={1}
                  className={cn(
                    "flex-1 min-h-[44px] max-h-32 resize-none py-3 px-4 rounded-2xl transition-colors",
                    isInternal
                      ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 focus-visible:ring-yellow-500"
                      : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                  )}
                />
              </SlashCommandMenu>

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={!canSend || isSending || isDisabled}
                size="icon"
                className={cn(
                  "rounded-full h-11 w-11 shrink-0 shadow-md transition-colors",
                  isInternal && "bg-yellow-500 hover:bg-yellow-600"
                )}
              >
                {isInternal ? (
                  <StickyNote className="h-5 w-5" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
