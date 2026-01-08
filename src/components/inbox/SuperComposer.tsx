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
import {
  Send,
  StickyNote,
  MessageCircle,
  AlertTriangle,
  Paperclip,
  Mic,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export interface SuperComposerProps {
  conversationId: string;
  isDisabled?: boolean;
  whatsappInstanceId?: string | null;
  contactPhone?: string | null;
}

export function SuperComposer({
  conversationId,
  isDisabled = false,
  whatsappInstanceId,
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
              }
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

  const handleAudioComplete = async (audioFile: File) => {
    setIsRecordingAudio(false);
    setPendingAttachments((prev) => [...prev, { file: audioFile }]);
    await upload(audioFile);
  };

  const handleSend = async () => {
    const hasContent = message.trim() || pendingAttachments.some((a) => a.uploadedMedia);
    if (!hasContent || !conversationId) return;

    const isInternal = messageMode === "internal";
    const messageContent = message.trim();

    try {
      // Internal note - just save to database
      if (isInternal) {
        await sendMessage.mutateAsync({
          conversation_id: conversationId,
          content: messageContent,
          sender_type: "user",
          sender_id: user?.id || null,
          status: 'sent',
          is_internal: true,
        });
      } else if (whatsappInstanceId && contactPhone) {
        // WhatsApp - send to Evolution API first
        try {
          const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('user_id')
            .eq('id', whatsappInstanceId)
            .single();
          
          const finalMessage = messageContent;
          
          const { error: evolutionError } = await supabase.functions.invoke('send-whatsapp-message', {
            body: {
              instance_id: whatsappInstanceId,
              phone_number: contactPhone,
              message: finalMessage,
              delay: 1000,
            }
          });

          if (evolutionError) {
            throw new Error(evolutionError.message || 'Failed to send WhatsApp message');
          }

          await sendMessage.mutateAsync({
            conversation_id: conversationId,
            content: messageContent,
            sender_type: "user",
            sender_id: user?.id || null,
            status: 'sent',
          });
        } catch (error) {
          console.error('[SuperComposer] WhatsApp send failed:', error);
          
          await sendMessage.mutateAsync({
            conversation_id: conversationId,
            content: messageContent,
            sender_type: "user",
            sender_id: user?.id || null,
            status: 'failed',
            delivery_error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        // Web chat - save directly
        await sendMessage.mutateAsync({
          conversation_id: conversationId,
          content: messageContent,
          sender_type: "user",
          sender_id: user?.id || null,
          status: 'sent',
        });
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
  const allUploaded = pendingAttachments.every((a) => a.uploadedMedia);
  const isSending = sendMessage.isPending;
  const canSend = (message.trim() || (hasAttachments && allUploaded)) && !isUploading;

  return (
    <div className="flex-none bg-card/95 backdrop-blur border-t border-border">
      {/* Tabs */}
      <div className="px-4 pt-3 flex items-center justify-between gap-3">
        <Tabs
          value={messageMode}
          onValueChange={(v) => setMessageMode(v as MessageMode)}
        >
          <TabsList className="h-8 p-0.5 bg-muted">
            <TabsTrigger
              value="public"
              className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-card"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Mensagem
            </TabsTrigger>
            <TabsTrigger
              value="internal"
              className={cn(
                "h-7 px-3 gap-1.5 text-xs",
                "data-[state=active]:bg-info/10 data-[state=active]:text-info",
                "dark:data-[state=active]:bg-info/20 dark:data-[state=active]:text-info"
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
        <div className="mx-4 mt-2 flex items-center gap-2 text-xs text-info bg-info/10 dark:bg-info/20 px-3 py-1.5 rounded-md border border-info/30">
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
                {att.preview ? (
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
                {!att.uploadedMedia && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white text-xs font-medium">
                      {Math.round(progress?.percentage || 0)}%
                    </div>
                  </div>
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
                      ? "bg-info/5 dark:bg-info/10 border-info/30 dark:border-info/40 focus-visible:ring-info"
                      : "bg-muted/50 dark:bg-muted border-border"
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
                  isInternal && "bg-info hover:bg-info/90"
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
