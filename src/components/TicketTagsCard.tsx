import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useTicketTags } from "@/hooks/useTicketTags";
import { useTags } from "@/hooks/useTags";
import { Tag, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketTagsCardProps {
  ticketId: string;
  readonly?: boolean;
}

export function TicketTagsCard({ ticketId, readonly = false }: TicketTagsCardProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const { data: ticketTags = [], isLoading, addTag, removeTag } = useTicketTags(ticketId);
  const { data: allTags = [] } = useTags("ticket");

  const ticketTagIds = ticketTags.map((t: any) => t.tag_id);
  const availableTags = allTags.filter((tag: any) => !ticketTagIds.includes(tag.id));
  const filteredTags = availableTags.filter((tag: any) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddTag = (tagId: string) => {
    addTag.mutate(tagId);
    setSearch("");
  };

  const handleRemoveTag = (tagId: string) => {
    removeTag.mutate(tagId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags do Ticket
          </CardTitle>
          
          {!readonly && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <Plus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <Input
                  placeholder="Buscar tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 mb-2"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredTags.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      {allTags.length === 0
                        ? "Nenhuma tag de ticket cadastrada"
                        : availableTags.length === 0
                        ? "Todas as tags já foram adicionadas"
                        : "Nenhuma tag encontrada"}
                    </p>
                  ) : (
                    filteredTags.map((tag: any) => (
                      <Button
                        key={tag.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 px-2"
                        onClick={() => handleAddTag(tag.id)}
                        disabled={addTag.isPending}
                      >
                        <span
                          className="w-3 h-3 rounded-full mr-2 shrink-0"
                          style={{ backgroundColor: tag.color || "#6B7280" }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </Button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {ticketTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma tag adicionada
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ticketTags.map((ticketTag: any) => (
              <Badge
                key={ticketTag.id}
                variant="secondary"
                className={cn(
                  "text-xs font-normal pr-1",
                  !readonly && "pr-0.5"
                )}
                style={{
                  backgroundColor: ticketTag.tags?.color
                    ? `${ticketTag.tags.color}20`
                    : undefined,
                  borderColor: ticketTag.tags?.color || undefined,
                  color: ticketTag.tags?.color || undefined,
                }}
              >
                {ticketTag.tags?.name}
                {!readonly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                    onClick={() => handleRemoveTag(ticketTag.tag_id)}
                    disabled={removeTag.isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
