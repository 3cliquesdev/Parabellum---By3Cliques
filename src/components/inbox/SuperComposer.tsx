import { useState, useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import { MacrosPopover } from "@/components/MacrosPopover";
import { FileDropZone } from "./FileDropZone";
import { AudioRecorder } from "./AudioRecorder";
import { FlowPickerButton } from "./FlowPickerButton";
import { useTestModeToggle } from "@/hooks/useTestModeToggle";
import { useActiveFlowState } from "@/hooks/useActiveFlowState";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useSendMessage } from "@/hooks/useMessages";
import { useSendMessageInstant } from "@/hooks/useSendMessageInstant";
import { useAuth } from "@/hooks/useAuth";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import { supabase } from "@/integrations/supabase/client";
import { getFreshMediaUrl } from "@/hooks/useMediaUrls";
import { needsTranscoding, transcodeToOgg, preloadFFmpeg } from "@/lib/audio/audioTranscoder";
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
  /** 
   * 🛡️ SEGURANÇA: ai_mode da conversa para bloquear envio automático 
   * Quando aiMode === 'waiting_human', o envio é bloqueado para evitar duplicação
   */
  aiMode?: 'autopilot' | 'copilot' | 'disabled' | 'waiting_human' | null;
  whatsappInstanceId?: string | null;
  whatsappMetaInstanceId?: string | null;
  whatsappProvider?: string | null;
  contactPhone?: string | null;
}

export function SuperComposer({
  conversationId,
  isDisabled = false,
  aiMode,
  whatsappInstanceId,
  whatsappMetaInstanceId,
  whatsappProvider,
  contactPhone,
}: SuperComposerProps) {
  const { activeFlow } = useActiveFlowState(conversationId);
  const [message, setMessage] = useState("");
  const [messageMode, setMessageMode] = useState<MessageMode>("public");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize até 6 linhas, depois scroll interno
  useAutoResizeTextarea(textareaRef, message, 6, 22);
  
  const { user } = useAuth();
  const sendMessage = useSendMessage();
  const { sendInstant } = useSendMessageInstant();
  const { isTestMode } = useTestModeToggle(conversationId);

  // Preload FFmpeg WASM when conversation opens (async, non-blocking)
  useEffect(() => {
    // Only preload if this is a WhatsApp conversation (likely to send audio)
    if (whatsappMetaInstanceId || whatsappInstanceId) {
      console.log('[SuperComposer] Preloading FFmpeg for WhatsApp conversation...');
      preloadFFmpeg().then((success) => {
        if (success) {
          console.log('[SuperComposer] FFmpeg preloaded successfully');
        }
      });
    }
  }, [whatsappMetaInstanceId, whatsappInstanceId]);
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

  // Handler para colar imagens do clipboard (Ctrl+V / Cmd+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const ext = file.type.split('/')[1] || 'png';
          const named = new File([file], `clipboard-${Date.now()}.${ext}`, { type: file.type });
          handleFileSelect(named);
        }
        return;
      }
    }
  };

  // Preload FFmpeg in background when composer mounts (for WhatsApp conversations)
  useEffect(() => {
    if (whatsappProvider === 'meta' || whatsappInstanceId) {
      console.log('[SuperComposer] Preloading FFmpeg in background...');
      preloadFFmpeg().then((ok) => {
        console.log('[SuperComposer] FFmpeg preload result:', ok);
      });
    }
  }, [whatsappProvider, whatsappInstanceId]);

  const handleStartAudioRecording = () => {
    // Start recording immediately - FFmpeg should already be preloaded in background
    setIsRecordingAudio(true);
  };

  const handleAudioComplete = async (audioFile: File) => {
    setIsRecordingAudio(false);

    // ✅ WhatsApp Meta NÃO aceita WebM como áudio. Precisamos transcodificar para OGG.
    let finalFile = audioFile;

    console.log('[SuperComposer] 🎙️ Audio recorded:', {
      type: audioFile.type,
      size: `${Math.round(audioFile.size / 1024)}KB`,
      name: audioFile.name,
    });

    if (needsTranscoding(audioFile.type)) {
      // Show persistent converting toast with progress
      const toastId = toast({
        title: "⏳ Convertendo áudio...",
        description: "Isso pode levar alguns segundos",
        duration: 60000, // Keep visible during conversion
      });

      try {
        // Timeout mais curto (30s) - se FFmpeg não carregou em background, provavelmente vai falhar
        const TRANSCODE_TIMEOUT_MS = 30000;
        const startTime = performance.now();

        const { blob, mimeType } = await Promise.race([
          transcodeToOgg(audioFile, audioFile.type),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Tempo limite de conversão excedido')), TRANSCODE_TIMEOUT_MS)
          ),
        ]);

        // Se a conversão ocorreu de fato, gerar um File novo
        if (mimeType !== audioFile.type) {
          finalFile = new File(
            [blob],
            audioFile.name.replace(/\.(webm|wav|mp3)$/i, '.ogg'),
            { type: mimeType }
          );
        }

        const tookMs = Math.round(performance.now() - startTime);
        console.log('[SuperComposer] ✅ Audio ready:', {
          originalType: audioFile.type,
          finalType: finalFile.type,
          originalSizeKB: Math.round(audioFile.size / 1024),
          finalSizeKB: Math.round(finalFile.size / 1024),
          tookMs,
        });

        // Dismiss converting toast and show success
        toast({
          title: "✅ Áudio convertido!",
          description: `Pronto em ${(tookMs / 1000).toFixed(1)}s`,
          duration: 2000,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[SuperComposer] ❌ Audio transcoding failed:', errorMessage);
        
        toast({
          title: "❌ Falha ao converter áudio",
          description: errorMessage.includes('timeout') || errorMessage.includes('limite')
            ? "Conversão demorou demais. Tente gravar um áudio mais curto."
            : "Não consegui preparar o áudio. Tente novamente.",
          variant: "destructive",
          duration: 5000,
        });
        // Não faz upload de WebM para WhatsApp Meta (não chega do outro lado)
        return;
      }
    }

    toast({
      title: "📤 Enviando áudio...",
      description: "Fazendo upload",
      duration: 3000,
    });

    setPendingAttachments((prev) => [...prev, { file: finalFile }]);
    await upload(finalFile);
  };

  // Helper unificado para detectar tipo de mídia (Evolution + Meta API)
  const detectMediaType = (mimeType: string): 'image' | 'audio' | 'video' | 'document' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  };

  const handleSend = async () => {
    // =========================================================================
    // 🛡️ REGRA DE SEGURANÇA: Bloquear envio em waiting_human
    // Isso evita duplicação por re-render ou retry visual no frontend
    // =========================================================================
    if (aiMode === 'waiting_human') {
      console.warn('[SuperComposer] ⛔ Bloqueado: aiMode é waiting_human - aguarde assumir a conversa');
      toast({
        title: "Aguardando atendente",
        description: "Você precisa assumir a conversa antes de enviar mensagens.",
        variant: "default",
      });
      return;
    }

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
    
    // Coletar anexos prontos
    const uploadedAttachments = pendingAttachments
      .filter(a => a.uploadedMedia)
      .map(a => a.uploadedMedia!);

    let sentMessageId: string | null = null;

    // ============================================
    // FLUXO OTIMISTA UNIFICADO: Todos os canais usam sendInstant
    // ============================================
    
    try {
      // Internal note - INSTANT
      if (isInternal) {
        sentMessageId = sendInstant({
          conversationId,
          content: messageContent,
          isInternal: true,
          channel: 'web_chat',
        });
      } 
      // WhatsApp Meta
      else if (whatsappProvider === 'meta' && whatsappMetaInstanceId && contactPhone) {
        console.log('[SuperComposer] 📲 Meta WhatsApp (Otimista)');
        
        // Se tem anexos, enviar primeiro anexo com caption
        if (uploadedAttachments.length > 0) {
          const firstAtt = uploadedAttachments[0];
          const freshUrl = await getFreshMediaUrl(firstAtt.id);
          
          if (freshUrl) {
            sentMessageId = sendInstant({
              conversationId,
              content: messageContent || `📎 ${firstAtt.filename}`,
              isInternal: false,
              channel: 'whatsapp',
              whatsappConfig: {
                provider: 'meta',
                instanceId: whatsappMetaInstanceId,
                phoneNumber: contactPhone,
                media: {
                  type: detectMediaType(firstAtt.mimeType),
                  url: freshUrl,
                  filename: firstAtt.filename,
                  mimeType: firstAtt.mimeType,
                },
              },
            });
          } else {
            toast({
              title: "Erro ao preparar mídia",
              description: `Não foi possível preparar ${firstAtt.filename} para envio.`,
              variant: "destructive",
            });
          }
          
          // Anexos adicionais (sem caption)
          for (let i = 1; i < uploadedAttachments.length; i++) {
            const att = uploadedAttachments[i];
            const url = await getFreshMediaUrl(att.id);
            if (url) {
              sendInstant({
                conversationId,
                content: `📎 ${att.filename}`,
                isInternal: false,
                channel: 'whatsapp',
                whatsappConfig: {
                  provider: 'meta',
                  instanceId: whatsappMetaInstanceId,
                  phoneNumber: contactPhone,
                  media: {
                    type: detectMediaType(att.mimeType),
                    url: url,
                    filename: att.filename,
                    mimeType: att.mimeType,
                  },
                },
              });
            }
          }
        } else {
          // Apenas texto
          sentMessageId = sendInstant({
            conversationId,
            content: messageContent,
            isInternal: false,
            channel: 'whatsapp',
            whatsappConfig: {
              provider: 'meta',
              instanceId: whatsappMetaInstanceId,
              phoneNumber: contactPhone,
            },
          });
        }
      }
      // WhatsApp Evolution (legacy)
      else if (whatsappInstanceId && contactPhone) {
        console.log('[SuperComposer] 📲 Evolution API (Otimista)');
        
        if (uploadedAttachments.length > 0) {
          const firstAtt = uploadedAttachments[0];
          const freshUrl = await getFreshMediaUrl(firstAtt.id);
          
          if (freshUrl) {
            sentMessageId = sendInstant({
              conversationId,
              content: messageContent || `📎 ${firstAtt.filename}`,
              isInternal: false,
              channel: 'whatsapp',
              whatsappConfig: {
                provider: 'evolution',
                instanceId: whatsappInstanceId,
                phoneNumber: contactPhone,
                media: {
                  type: detectMediaType(firstAtt.mimeType),
                  url: freshUrl,
                  filename: firstAtt.filename,
                  mimeType: firstAtt.mimeType,
                },
              },
            });
          }
          
          // Anexos adicionais
          for (let i = 1; i < uploadedAttachments.length; i++) {
            const att = uploadedAttachments[i];
            const url = await getFreshMediaUrl(att.id);
            if (url) {
              sendInstant({
                conversationId,
                content: `📎 ${att.filename}`,
                isInternal: false,
                channel: 'whatsapp',
                whatsappConfig: {
                  provider: 'evolution',
                  instanceId: whatsappInstanceId,
                  phoneNumber: contactPhone,
                  media: {
                    type: detectMediaType(att.mimeType),
                    url: url,
                    filename: att.filename,
                    mimeType: att.mimeType,
                  },
                },
              });
            }
          }
        } else {
          // Apenas texto
          sentMessageId = sendInstant({
            conversationId,
            content: messageContent,
            isInternal: false,
            channel: 'whatsapp',
            whatsappConfig: {
              provider: 'evolution',
              instanceId: whatsappInstanceId,
              phoneNumber: contactPhone,
            },
          });
        }
      }
      // Web chat - INSTANT
      else {
        sentMessageId = sendInstant({
          conversationId,
          content: messageContent || (uploadedAttachments.length > 0 ? '📎 Anexo' : ''),
          isInternal: false,
          channel: 'web_chat',
        });
      }

      // 🔗 VINCULAR ANEXOS À MENSAGEM (em background)
      if (sentMessageId && uploadedAttachments.length > 0) {
        const attachmentIds = uploadedAttachments.map(a => a.id);
        console.log('[SuperComposer] Vinculando anexos:', sentMessageId, attachmentIds);
        
        supabase
          .from('media_attachments')
          .update({ message_id: sentMessageId })
          .in('id', attachmentIds)
          .then(({ error }) => {
            if (error) console.error('[SuperComposer] Erro ao vincular anexos:', error);
          });
      }

      // LIMPAR STATE IMEDIATAMENTE - não bloqueia!
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
    <div className="border-t border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-surface))]">
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

      {/* ========== WRAPPER ENTERPRISE (WhatsApp Web Style) ========== */}
      <div className="px-4 py-2">
        <div className="flex items-end gap-3 rounded-2xl border border-[hsl(var(--chat-border))] bg-background p-2.5">
          {isRecordingAudio ? (
            <AudioRecorder
              onRecordingComplete={handleAudioComplete}
              onCancel={() => setIsRecordingAudio(false)}
              disabled={isDisabled}
            />
          ) : (
            <>
              {/* Flow Picker Button */}
              <FlowPickerButton
                conversationId={conversationId}
                disabled={isDisabled || isSending}
                isTestMode={isTestMode}
                hasActiveFlow={!!activeFlow}
              />

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
                onClick={handleStartAudioRecording}
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

              {/* TEXTAREA ATUALIZADO - Auto-resize */}
              <div className="flex-1 min-w-0">
                <SlashCommandMenu value={message} onChange={setMessage}>
                  <Textarea
                    ref={textareaRef}
                    placeholder={isDisabled ? "Conversa encerrada" : "Digite sua mensagem ou / para macros..."}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    onPaste={handlePaste}
                    disabled={isSending || isDisabled}
                    rows={1}
                    className={cn(
                      "w-full resize-none bg-transparent border-0",
                      "text-[15px] leading-[22px]",
                      "px-2 py-2.5",
                      "min-h-[44px] max-h-[160px]",
                      "focus-visible:ring-0 focus-visible:ring-offset-0",
                      "placeholder:text-muted-foreground",
                      isInternal && "bg-yellow-50/50 dark:bg-yellow-900/20"
                    )}
                  />
                </SlashCommandMenu>
              </div>

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

        {/* HINT ENTERPRISE */}
        <div className="mt-1.5 flex justify-end text-[11px] text-muted-foreground">
          Enter envia • Shift+Enter quebra linha
        </div>
      </div>
    </div>
  );
}
