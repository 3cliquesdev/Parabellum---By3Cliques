import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Tag, X } from "lucide-react";
import { useTags, useContactTags } from "@/hooks/useTags";
import { useAddContactTag, useRemoveContactTag } from "@/hooks/useContactTagsMutation";

interface ContactTagsSectionProps {
  contactId: string;
}

export default function ContactTagsSection({ contactId }: ContactTagsSectionProps) {
  const [open, setOpen] = useState(false);
  const { data: allTags = [] } = useTags();
  const { data: contactTags = [] } = useContactTags(contactId);
  const addTag = useAddContactTag();
  const removeTag = useRemoveContactTag();

  const contactTagIds = contactTags.map((t: any) => t.id);

  const handleToggleTag = (tagId: string, isChecked: boolean) => {
    if (isChecked) {
      addTag.mutate({ contactId, tagId });
    } else {
      removeTag.mutate({ contactId, tagId });
    }
  };

  const handleRemoveTag = (tagId: string) => {
    removeTag.mutate({ contactId, tagId });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          Tags
        </p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Plus className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Selecionar Tags</p>
            </div>
            <ScrollArea className="h-64">
              <div className="p-2 space-y-1">
                {allTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2 text-center">
                    Nenhuma tag disponível
                  </p>
                ) : (
                  allTags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={contactTagIds.includes(tag.id)}
                        onCheckedChange={(checked) =>
                          handleToggleTag(tag.id, checked as boolean)
                        }
                      />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color || "#6b7280" }}
                      />
                      <span className="text-sm">{tag.name}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Tags atuais */}
      <div className="flex flex-wrap gap-1.5">
        {contactTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem tags</p>
        ) : (
          contactTags.map((tag: any) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs gap-1 pr-1"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                borderColor: tag.color,
              }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-0.5 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
