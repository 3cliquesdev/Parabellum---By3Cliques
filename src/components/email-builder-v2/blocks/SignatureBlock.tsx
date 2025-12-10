import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useState } from "react";
import type { EmailBlock } from "@/types/emailBuilderV2";

interface SignatureBlockProps {
  block: EmailBlock;
  isSelected: boolean;
  onUpdate: (content: { name?: string; role?: string; email?: string; src?: string }) => void;
  readOnly?: boolean;
}

export function SignatureBlock({ block, isSelected, onUpdate, readOnly }: SignatureBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={cn(
        "relative group transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        backgroundColor: block.styles.backgroundColor,
        padding: block.styles.padding || "20px",
        textAlign: block.styles.textAlign || "left",
      }}
    >
      <div className="flex items-start gap-4">
        {block.content.src && (
          <img
            src={block.content.src}
            alt={block.content.name || "Avatar"}
            className="w-16 h-16 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <p className="font-semibold text-slate-900" style={{ color: block.styles.color }}>
            {block.content.name || "Nome do Remetente"}
          </p>
          <p className="text-sm text-slate-600">
            {block.content.role || "Cargo / Função"}
          </p>
          {block.content.email && (
            <a
              href={`mailto:${block.content.email}`}
              className="text-sm text-primary hover:underline"
            >
              {block.content.email}
            </a>
          )}
        </div>
      </div>

      {!readOnly && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={block.content.name || ""}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo</Label>
                <Input
                  value={block.content.role || ""}
                  onChange={(e) => onUpdate({ role: e.target.value })}
                  placeholder="Gerente de Vendas"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={block.content.email || ""}
                  onChange={(e) => onUpdate({ email: e.target.value })}
                  placeholder="joao@empresa.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL do Avatar</Label>
                <Input
                  value={block.content.src || ""}
                  onChange={(e) => onUpdate({ src: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
