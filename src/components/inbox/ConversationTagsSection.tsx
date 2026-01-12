import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { X, Tag, Search } from "lucide-react";
import { useTags, useConversationTags, useAddConversationTag, useRemoveConversationTag } from "@/hooks/useTags";

interface ConversationTagsSectionProps {
  conversationId: string;
}

export function ConversationTagsSection({ conversationId }: ConversationTagsSectionProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allTags = [] } = useTags(); // Tags universais - sem filtro por categoria
  const { data: conversationTags = [] } = useConversationTags(conversationId);
  const addTag = useAddConversationTag();
  const removeTag = useRemoveConversationTag();

  const conversationTagIds = conversationTags.map((t: any) => t.id);

  const filteredTags = allTags.filter((tag: any) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleTag = (tagId: string, isChecked: boolean) => {
    if (isChecked) {
      addTag.mutate({ conversationId, tagId });
    } else {
      removeTag.mutate({ conversationId, tagId });
    }
  };

  const handleRemoveTag = (tagId: string) => {
    removeTag.mutate({ conversationId, tagId });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {conversationTags.map((tag: any) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="text-xs flex items-center gap-1 pr-1"
          style={{ backgroundColor: tag.color + "20", color: tag.color, borderColor: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => handleRemoveTag(tag.id)}
            className="hover:bg-black/10 rounded p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setSearch("");
      }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs text-foreground border-border">
            <Tag className="h-3 w-3 mr-1" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 bg-popover border border-border z-50" align="start">
          <div className="text-xs font-medium text-foreground mb-2">Adicionar Tag</div>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Buscar tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs pl-7"
            />
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredTags.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">
                {search ? "Nenhuma tag encontrada" : "Nenhuma tag cadastrada"}
              </p>
            ) : (
              filteredTags.map((tag: any) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={conversationTagIds.includes(tag.id)}
                    onCheckedChange={(checked) => handleToggleTag(tag.id, !!checked)}
                  />
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: tag.color + "20", color: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
