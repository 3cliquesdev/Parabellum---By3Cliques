import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useSupportChannels } from "@/hooks/useSupportChannels";

interface SupportChannelsMultiSelectProps {
  selectedChannelIds: string[];
  onSelectionChange: (channelIds: string[]) => void;
}

export function SupportChannelsMultiSelect({
  selectedChannelIds,
  onSelectionChange,
}: SupportChannelsMultiSelectProps) {
  const { data: channels, isLoading } = useSupportChannels();

  const handleToggle = (channelId: string) => {
    const isSelected = selectedChannelIds.includes(channelId);
    if (isSelected) {
      onSelectionChange(selectedChannelIds.filter(id => id !== channelId));
    } else {
      onSelectionChange([...selectedChannelIds, channelId]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Nenhum canal de atendimento disponível
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px] rounded-md border p-4">
      <div className="space-y-3">
        {channels.map((channel) => {
          const isSelected = selectedChannelIds.includes(channel.id);
          
          return (
            <div
              key={channel.id}
              className="flex items-start space-x-3 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
              onClick={() => handleToggle(channel.id)}
            >
              <Checkbox
                id={channel.id}
                checked={isSelected}
                onCheckedChange={() => handleToggle(channel.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    style={{
                      backgroundColor: `${channel.color}15`,
                      borderColor: channel.color,
                      color: channel.color,
                    }}
                    className="text-xs font-medium"
                  >
                    {channel.name}
                  </Badge>
                </div>
                {channel.description && (
                  <p className="text-xs text-muted-foreground">
                    {channel.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
