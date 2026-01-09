import { useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Code, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EmailBlock } from "@/types/emailBuilderV2";

interface HtmlBlockProps {
  block: EmailBlock;
  isSelected: boolean;
  onUpdate: (content: { html: string }) => void;
  readOnly?: boolean;
}

export function HtmlBlock({ block, isSelected, onUpdate, readOnly }: HtmlBlockProps) {
  const [mode, setMode] = useState<"code" | "preview">("preview");

  return (
    <div
      className={cn(
        "relative transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      style={{
        backgroundColor: block.styles.backgroundColor || '#ffffff',
        color: '#1e293b',
        padding: block.styles.padding || "16px",
      }}
    >
      {readOnly ? (
        <div dangerouslySetInnerHTML={{ __html: block.content.html || "" }} />
      ) : (
        <Tabs value={mode} onValueChange={(v) => setMode(v as "code" | "preview")}>
          <div className="flex items-center justify-between mb-2">
            <TabsList className="h-8 bg-slate-100">
              <TabsTrigger value="preview" className="text-xs gap-1 text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                <Eye className="h-3 w-3" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs gap-1 text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                <Code className="h-3 w-3" />
                HTML
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="preview" className="mt-0">
            {block.content.html ? (
              <div dangerouslySetInnerHTML={{ __html: block.content.html }} />
            ) : (
              <div className="text-center text-muted-foreground py-4 border border-dashed rounded">
                <Code className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Clique em "HTML" para adicionar código</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="mt-0">
            <Textarea
              value={block.content.html || ""}
              onChange={(e) => onUpdate({ html: e.target.value })}
              placeholder="<div>Seu HTML aqui...</div>"
              className="font-mono text-xs min-h-[150px]"
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
