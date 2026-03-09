import React, { useState, useRef, useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import type { Node, Edge } from "reactflow";
import { getAvailableVariables, findOrphanVariables, type VariableItem } from "./variableCatalog";

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  flow: { label: "Variáveis do Fluxo", icon: "💾" },
  contact: { label: "Contato", icon: "👤" },
  conversation: { label: "Conversa", icon: "📡" },
  order: { label: "Pedido", icon: "📦" },
};

export function VariableAutocomplete({
  value,
  onChange,
  nodes,
  edges,
  selectedNodeId,
  placeholder,
  className,
  minHeight = "80px",
}: VariableAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef<number>(0);

  const { flowVars, contactVars, conversationVars, orderVars } = useMemo(
    () => getAvailableVariables(nodes, edges, selectedNodeId),
    [nodes, edges, selectedNodeId]
  );

  const orphans = useMemo(
    () => findOrphanVariables(value || "", nodes, edges, selectedNodeId),
    [value, nodes, edges, selectedNodeId]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;
      cursorPosRef.current = cursorPos;
      onChange(newValue);

      // Detect {{ trigger
      const textBefore = newValue.substring(0, cursorPos);
      const triggerMatch = textBefore.match(/\{\{([a-zA-Z0-9_]*)$/);
      if (triggerMatch) {
        setFilter(triggerMatch[1] || "");
        setOpen(true);
      } else {
        setOpen(false);
      }
    },
    [onChange]
  );

  const insertVariable = useCallback(
    (varName: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = cursorPosRef.current;
      const textBefore = value.substring(0, cursorPos);
      const textAfter = value.substring(cursorPos);

      // Find where {{ starts
      const triggerMatch = textBefore.match(/\{\{([a-zA-Z0-9_]*)$/);
      if (triggerMatch) {
        const start = cursorPos - triggerMatch[0].length;
        const insertion = `{{${varName}}}`;
        const newValue = value.substring(0, start) + insertion + textAfter;
        onChange(newValue);

        // Set cursor after insertion
        setTimeout(() => {
          const newPos = start + insertion.length;
          textarea.setSelectionRange(newPos, newPos);
          textarea.focus();
        }, 0);
      }

      setOpen(false);
      setFilter("");
    },
    [value, onChange]
  );

  const renderGroup = (items: VariableItem[], groupKey: string) => {
    if (items.length === 0) return null;
    const { label, icon } = GROUP_LABELS[groupKey] || { label: groupKey, icon: "📌" };
    const filtered = filter
      ? items.filter(v => v.value.toLowerCase().includes(filter.toLowerCase()) || v.label.toLowerCase().includes(filter.toLowerCase()))
      : items;
    if (filtered.length === 0) return null;

    return (
      <CommandGroup key={groupKey} heading={`${icon} ${label}`}>
        {filtered.map(v => (
          <CommandItem
            key={v.value}
            value={v.value}
            onSelect={() => insertVariable(v.value)}
          >
            <span className="font-mono text-xs">{`{{${v.value}}}`}</span>
            <span className="ml-2 text-xs text-muted-foreground">{v.label}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <div className="relative space-y-1">
      <Popover open={open} onOpenChange={(o) => { if (!o) return; setOpen(o); }}>
        <PopoverTrigger asChild>
          <div>
            <Textarea
              ref={textareaRef}
              value={value || ""}
              onChange={handleChange}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape" && open) {
                  setOpen(false);
                  e.preventDefault();
                }
              }}
              placeholder={placeholder}
              className={className}
              style={{ minHeight }}
            />
          </div>
        </PopoverTrigger>
        {open && (
          <PopoverContent
            className="w-80 p-0"
            side="bottom"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar variável..."
                value={filter}
                onValueChange={setFilter}
              />
              <CommandList>
                <CommandEmpty>Nenhuma variável encontrada</CommandEmpty>
                {renderGroup(flowVars, "flow")}
                {renderGroup(contactVars, "contact")}
                {renderGroup(conversationVars, "conversation")}
                {renderGroup(orderVars, "order")}
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>

      {/* Orphan variable warnings */}
      {orphans.length > 0 && (
        <div className="space-y-1">
          {orphans.map(varName => (
            <div key={varName} className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30">
                ⚠️ Variável {`"{{${varName}}}"`} não definida antes deste nó
              </Badge>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Adicione um nó ask_* com save_as={orphans[0]} ou use contact_{orphans[0]}
          </p>
        </div>
      )}
    </div>
  );
}
