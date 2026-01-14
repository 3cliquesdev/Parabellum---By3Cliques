import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Monitor, Smartphone, RefreshCw, Code, Eye } from "lucide-react";
import { generateEmailHTML, replaceVariables, defaultSampleData } from "@/utils/emailHtmlGenerator";
import { useEmailVariables } from "@/hooks/useEmailBuilderV2";
import type { EmailBlock } from "@/types/emailBuilderV2";

interface PreviewPanelProps {
  blocks: EmailBlock[];
  subject?: string;
  preheader?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  contact: "Contato",
  deal: "Negócio",
  organization: "Organização",
  custom: "Personalizados",
};

export function PreviewPanel({ 
  blocks, 
  subject, 
  preheader, 
  trigger,
  open,
  onOpenChange 
}: PreviewPanelProps) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [showHtml, setShowHtml] = useState(false);
  const [sampleData, setSampleData] = useState<Record<string, string>>(defaultSampleData);
  
  const { data: variables } = useEmailVariables();

  // Generate HTML with variable substitution
  const generatedHtml = useMemo(() => {
    const rawHtml = generateEmailHTML(blocks, { preheader, subject });
    return replaceVariables(rawHtml, sampleData);
  }, [blocks, preheader, subject, sampleData]);

  // Generate subject with variable substitution
  const previewSubject = useMemo(() => {
    return replaceVariables(subject || "", sampleData);
  }, [subject, sampleData]);

  // Group variables by category
  const groupedVariables = useMemo(() => {
    if (!variables) return {};
    return variables.reduce((acc, v) => {
      const category = v.category || "other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(v);
      return acc;
    }, {} as Record<string, typeof variables>);
  }, [variables]);

  const handleUpdateSampleData = (key: string, value: string) => {
    setSampleData((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetData = () => {
    setSampleData(defaultSampleData);
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Eye className="h-4 w-4 mr-2" />
      Preview
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Preview do Email</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={viewMode === "desktop" ? "default" : "outline"}
                onClick={() => setViewMode("desktop")}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === "mobile" ? "default" : "outline"}
                onClick={() => setViewMode("mobile")}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-2" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowHtml(!showHtml)}
              >
                <Code className="h-4 w-4 mr-2" />
                {showHtml ? "Visual" : "HTML"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
            {/* Subject preview */}
            {previewSubject && (
              <div className="mx-6 mt-4 p-3 bg-card rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Assunto</p>
                <p className="font-medium">{previewSubject}</p>
              </div>
            )}

            {/* Email preview */}
            <div className="flex-1 overflow-auto p-6">
              {showHtml ? (
                <ScrollArea className="h-full bg-card rounded-lg border">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                    {generatedHtml}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="h-full flex justify-center">
                  <iframe
                    srcDoc={generatedHtml}
                    title="Email Preview"
                    className="bg-white shadow-lg rounded-lg border"
                    style={{
                      width: viewMode === "mobile" ? "375px" : "600px",
                      height: "100%",
                      minHeight: "600px",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Sample Data */}
          <div className="w-80 border-l bg-card flex flex-col">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-medium text-sm">Dados de Exemplo</h3>
                <p className="text-xs text-muted-foreground">
                  Personalize os valores
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={handleResetData}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {Object.keys(groupedVariables).length > 0 ? (
                  <Accordion type="multiple" defaultValue={["contact"]} className="space-y-2">
                    {Object.entries(groupedVariables).map(([category, vars]) => (
                      <AccordionItem key={category} value={category} className="border rounded-lg px-3">
                        <AccordionTrigger className="text-sm py-3 hover:no-underline">
                          {CATEGORY_LABELS[category] || category}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({vars.length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3 space-y-3">
                          {vars.map((variable) => (
                            <div key={variable.variable_key} className="space-y-1">
                              <Label className="text-xs flex items-center gap-2">
                                <code className="text-primary bg-primary/10 px-1 rounded text-[10px]">
                                  {`{{${variable.variable_key}}}`}
                                </code>
                              </Label>
                              <Input
                                value={sampleData[variable.variable_key] || ""}
                                onChange={(e) => handleUpdateSampleData(variable.variable_key, e.target.value)}
                                placeholder={variable.sample_value || variable.display_name}
                                className="h-8 text-sm"
                              />
                            </div>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground mb-4">
                      Variáveis padrão do sistema
                    </p>
                    {Object.entries(defaultSampleData).map(([key, defaultValue]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">
                          <code className="text-primary bg-primary/10 px-1 rounded text-[10px]">
                            {`{{${key}}}`}
                          </code>
                        </Label>
                        <Input
                          value={sampleData[key] || ""}
                          onChange={(e) => handleUpdateSampleData(key, e.target.value)}
                          placeholder={defaultValue}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
