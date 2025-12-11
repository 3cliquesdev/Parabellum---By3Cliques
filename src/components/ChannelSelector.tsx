/**
 * ChannelSelector Component
 * 
 * Seletor de canal de resposta com sugestão inteligente.
 * Mostra canal recomendado com destaque e alternativas disponíveis.
 */

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, AlertCircle } from "lucide-react";
import type { ChannelOption, ChannelType } from "@/hooks/useReplyChannel";

interface ChannelSelectorProps {
  selectedChannel: ChannelType;
  onChannelChange: (channel: ChannelType) => void;
  availableChannels: ChannelOption[];
  disabled?: boolean;
  compact?: boolean;
}

const CHANNEL_COLORS: Record<ChannelType, string> = {
  whatsapp: "bg-green-500/10 text-green-600 border-green-500/30",
  web_chat: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  email: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  instagram: "bg-purple-500/10 text-purple-600 border-purple-500/30",
};

export function ChannelSelector({
  selectedChannel,
  onChannelChange,
  availableChannels,
  disabled = false,
  compact = false,
}: ChannelSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = availableChannels.find(
    (ch) => ch.channel === selectedChannel
  );

  const handleSelect = (channel: ChannelType) => {
    onChannelChange(channel);
    setOpen(false);
  };

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-8 gap-1.5 px-2 text-xs border",
              CHANNEL_COLORS[selectedChannel]
            )}
          >
            <span>{selectedOption?.icon || "💬"}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {availableChannels.map((option) => (
            <ChannelOptionItem
              key={option.channel}
              option={option}
              isSelected={option.channel === selectedChannel}
              onSelect={() => handleSelect(option.channel)}
            />
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-9 gap-2 px-3 text-sm border",
            CHANNEL_COLORS[selectedChannel]
          )}
        >
          <span>{selectedOption?.icon || "💬"}</span>
          <span className="hidden sm:inline">{selectedOption?.label || "Canal"}</span>
          {selectedOption?.isRecommended && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
              Auto
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Responder via
        </div>
        {availableChannels.map((option) => (
          <ChannelOptionItem
            key={option.channel}
            option={option}
            isSelected={option.channel === selectedChannel}
            onSelect={() => handleSelect(option.channel)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

interface ChannelOptionItemProps {
  option: ChannelOption;
  isSelected: boolean;
  onSelect: () => void;
}

function ChannelOptionItem({
  option,
  isSelected,
  onSelect,
}: ChannelOptionItemProps) {
  return (
    <button
      onClick={onSelect}
      disabled={!option.isAvailable}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
        "hover:bg-accent",
        isSelected && "bg-accent",
        !option.isAvailable && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className="text-base">{option.icon}</span>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{option.label}</span>
          {option.isRecommended && (
            <Badge
              variant="secondary"
              className="h-4 px-1.5 text-[10px] font-normal bg-primary/10 text-primary"
            >
              Sugerido
            </Badge>
          )}
        </div>
        {option.reason && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <AlertCircle className="h-3 w-3" />
            {option.reason}
          </div>
        )}
      </div>
      {isSelected && option.isAvailable && (
        <Check className="h-4 w-4 text-primary" />
      )}
    </button>
  );
}
