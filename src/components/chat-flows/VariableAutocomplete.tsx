import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Node, Edge } from "reactflow";
import { getAvailableVariables, findOrphanVariables, type VariableItem } from "./variableCatalog";
import { cn } from "@/lib/utils";

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
  collection: { label: "Dados Coletados", icon: "📋" },
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef<number>(0);

  const { flowVars, contactVars, conversationVars, orderVars, collectionVars } = useMemo(
    () => getAvailableVariables(nodes, edges, selectedNodeId),
    [nodes, edges, selectedNodeId]
  );

  const orphans = useMemo(
    () => findOrphanVariables(value || "", nodes, edges, selectedNodeId),
    [value, nodes, edges, selectedNodeId]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        dropdownRef.current?.contains(target) ||
        textareaRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const syncAutocomplete = useCallback(
    (text: string, cursorPos: number) => {
      const textBefore = text.substring(0, cursorPos);
      const triggerMatch = textBefore.match(/\{\{([a-zA-Z0-9_.]*)$/);

      if (triggerMatch) {
        setFilter(triggerMatch[1] || "");
        setOpen(true);
      } else {
        setOpen(false);
      }
    },
    []
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;
      cursorPosRef.current = cursorPos;
      onChange(newValue);
      syncAutocomplete(newValue, cursorPos);
    },
    [onChange, syncAutocomplete]
  );

  const insertVariable = useCallback(
    (varName: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = cursorPosRef.current;
      const textBefore = value.substring(0, cursorPos);
      const textAfter = value.substring(cursorPos);

      const triggerMatch = textBefore.match(/\{\{([a-zA-Z0-9_.]*)$/);
      if (triggerMatch) {
        const start = cursorPos - triggerMatch[0].length;
        const insertion = `{{${varName}}}`;
        const newValue = value.substring(0, start) + insertion + textAfter;
        onChange(newValue);

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

  const filterItems = (items: VariableItem[]) => {
    if (!filter) return items;
    const f = filter.toLowerCase();
    return items.filter(v => v.value.toLowerCase().includes(f) || v.label.toLowerCase().includes(f));
  };

  const renderGroup = (items: VariableItem[], groupKey: string) => {
    const filtered = filterItems(items);
    if (filtered.length === 0) return null;
    const { label, icon } = GROUP_LABELS[groupKey] || { label: groupKey, icon: "📌" };

    return (
      <div key={groupKey}>
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {icon} {label}
        </div>
        {filtered.map(v => (
          <button
            key={v.value}
            type="button"
            className="w-full flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent textarea blur
              insertVariable(v.value);
            }}
          >
            <span className="font-mono text-xs">{`{{${v.value}}}`}</span>
            <span className="ml-2 text-xs text-muted-foreground">{v.label}</span>
          </button>
        ))}
      </div>
    );
  };

  const hasResults = filterItems(flowVars).length > 0 ||
    filterItems(collectionVars).length > 0 ||
    filterItems(contactVars).length > 0 ||
    filterItems(conversationVars).length > 0 ||
    filterItems(orderVars).length > 0;

  const handleVariableButtonClick = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    textarea.focus();
    const cursorPos = textarea.selectionStart || 0;
    const before = (value || "").substring(0, cursorPos);
    const after = (value || "").substring(cursorPos);
    const newValue = before + "{{" + after;
    onChange(newValue);
    
    const newPos = cursorPos + 2;
    cursorPosRef.current = newPos;
    
    setTimeout(() => {
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
      setFilter("");
      setOpen(true);
    }, 0);
  }, [value, onChange]);

  return (
    <div className="relative space-y-1">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value || ""}
          onChange={handleChange}
          onFocus={(e) => {
            const cursorPos = e.currentTarget.selectionStart || 0;
            cursorPosRef.current = cursorPos;
            syncAutocomplete(e.currentTarget.value, cursorPos);
          }}
          onClick={(e) => {
            const cursorPos = e.currentTarget.selectionStart || 0;
            cursorPosRef.current = cursorPos;
            syncAutocomplete(e.currentTarget.value, cursorPos);
          }}
          onKeyUp={(e) => {
            const cursorPos = e.currentTarget.selectionStart || 0;
            cursorPosRef.current = cursorPos;
            syncAutocomplete(e.currentTarget.value, cursorPos);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape" && open) {
              setOpen(false);
              e.preventDefault();
            }
          }}
          placeholder={placeholder}
          className={cn("pr-10", className)}
          style={{ minHeight }}
        />
        <button
          type="button"
          onClick={handleVariableButtonClick}
          className="absolute top-2 right-2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
          title="Inserir variável"
        >
          <span className="font-mono text-xs font-bold">{"{x}"}</span>
        </button>
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-80 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar variável..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </div>
          <ScrollArea className="max-h-[250px]">
            <div className="p-1">
              {hasResults ? (
                <>
                  {renderGroup(flowVars, "flow")}
                  {renderGroup(contactVars, "contact")}
                  {renderGroup(conversationVars, "conversation")}
                  {renderGroup(orderVars, "order")}
                </>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma variável encontrada
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

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
