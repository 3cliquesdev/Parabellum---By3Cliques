import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import { MacrosPopover } from "@/components/MacrosPopover";
import { ChannelSelector } from "@/components/ChannelSelector";
import { Send, StickyNote, MessageCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelType, ChannelOption } from "@/hooks/useReplyChannel";

export type MessageMode = "public" | "internal";

interface ChatComposerProps {
  message: string;
  setMessage: (value: string) => void;
  onSendMessage: (isInternal: boolean, channel?: ChannelType) => void;
  isSending: boolean;
  isDisabled: boolean;
  placeholder?: string;
  // Reply Smart props
  selectedChannel?: ChannelType;
  onChannelChange?: (channel: ChannelType) => void;
  availableChannels?: ChannelOption[];
  showChannelSelector?: boolean;
}

// FASE 5: Super Composer com tabs Público/Interno + Reply Smart
export function ChatComposer({
  message,
  setMessage,
  onSendMessage,
  isSending,
  isDisabled,
  placeholder = "Digite sua mensagem ou / para macros...",
  selectedChannel = "web_chat",
  onChannelChange,
  availableChannels = [],
  showChannelSelector = false,
}: ChatComposerProps) {
  const [messageMode, setMessageMode] = useState<MessageMode>("public");
  const [localChannel, setLocalChannel] = useState<ChannelType>(selectedChannel);

  // Sincronizar com prop externa
  useEffect(() => {
    setLocalChannel(selectedChannel);
  }, [selectedChannel]);

  const handleChannelChange = (channel: ChannelType) => {
    setLocalChannel(channel);
    onChannelChange?.(channel);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(messageMode === "internal", localChannel);
    }
  };

  const handleMacroSelect = (content: string) => {
    setMessage(content);
  };

  const handleSend = () => {
    onSendMessage(messageMode === "internal", localChannel);
  };

  const isInternal = messageMode === "internal";

  return (
    <div className="flex-none bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-slate-200 dark:border-zinc-800">
      {/* Tabs de Modo */}
      <div className="px-4 pt-3 flex items-center justify-between gap-3">
        <Tabs value={messageMode} onValueChange={(v) => setMessageMode(v as MessageMode)}>
          <TabsList className="h-8 p-0.5 bg-slate-100 dark:bg-zinc-800">
            <TabsTrigger 
              value="public" 
              className="h-7 px-3 gap-1.5 text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Mensagem Pública
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

        {/* Reply Smart: Seletor de Canal */}
        {showChannelSelector && !isInternal && availableChannels.length > 0 && (
          <ChannelSelector
            selectedChannel={localChannel}
            onChannelChange={handleChannelChange}
            availableChannels={availableChannels}
            disabled={isDisabled || isSending}
          />
        )}
      </div>

      {/* Aviso de Nota Interna */}
      {isInternal && (
        <div className="mx-4 mt-2 flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 px-3 py-1.5 rounded-md">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Esta mensagem é visível apenas para a equipe interna</span>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 pt-3">
        <div className="max-w-3xl mx-auto flex gap-2 items-center">
          {/* Botão de Macros */}
          <MacrosPopover 
            onSelectMacro={handleMacroSelect} 
            disabled={isDisabled || isSending}
          />

          {/* Input com SlashCommand */}
          <SlashCommandMenu value={message} onChange={setMessage}>
            <Input
              placeholder={isDisabled ? "Conversa encerrada" : placeholder}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending || isDisabled}
              className={cn(
                "flex-1 rounded-full px-5 py-3 h-12 transition-colors",
                isInternal 
                  ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 focus-visible:ring-yellow-500"
                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
              )}
            />
          </SlashCommandMenu>

          {/* Botão Enviar */}
          <Button 
            onClick={handleSend}
            disabled={isSending || !message.trim() || isDisabled}
            size="icon"
            className={cn(
              "rounded-full h-12 w-12 shrink-0 shadow-md transition-colors",
              isInternal && "bg-yellow-500 hover:bg-yellow-600"
            )}
          >
            {isInternal ? (
              <StickyNote className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
