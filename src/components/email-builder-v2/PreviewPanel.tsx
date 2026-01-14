import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Monitor, Smartphone, RefreshCw, Code, Eye } from "lucide-react";
import { generateEmailHTML, replaceVariables, defaultSampleData } from "@/utils/emailHtmlGenerator";
import { useEmailVariables } from "@/hooks/useEmailBuilderV2";
import type { EmailBlock } from "@/types/emailBuilderV2";

interface PreviewPanelProps {
  blocks: EmailBlock[];
  subject?: string;
  preheader?: string;
}

export function PreviewPanel({ blocks, subject, preheader }: PreviewPanelProps) {
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

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="preview" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 grid grid-cols-2">
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Code className="h-4 w-4" />
            Dados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="flex-1 flex flex-col m-0 p-4">
          {/* Preview controls */}
          <div className="flex items-center justify-between mb-4">
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
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHtml(!showHtml)}
            >
              <Code className="h-4 w-4 mr-2" />
              {showHtml ? "Preview" : "HTML"}
            </Button>
          </div>

          {/* Subject preview */}
          {previewSubject && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Assunto</p>
              <p className="font-medium">{previewSubject}</p>
            </div>
          )}

          {/* Email preview */}
          <div className="flex-1 relative overflow-hidden border rounded-lg bg-slate-100">
            {showHtml ? (
              <ScrollArea className="h-full">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                  {generatedHtml}
                </pre>
              </ScrollArea>
            ) : (
              <div
                className="h-full overflow-auto flex justify-center p-4"
                style={{
                  backgroundColor: "#f1f5f9",
                }}
              >
                <iframe
                  srcDoc={generatedHtml}
                  title="Email Preview"
                  className="bg-white shadow-lg rounded-lg"
                  style={{
                    width: viewMode === "mobile" ? "375px" : "600px",
                    height: "100%",
                    minHeight: "500px",
                    border: "none",
                  }}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="data" className="flex-1 m-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Dados de Exemplo</h3>
                  <p className="text-sm text-muted-foreground">
                    Personalize os valores para testar a prévia
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={handleResetData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Resetar
                </Button>
              </div>

              {Object.entries(groupedVariables).map(([category, vars]) => (
                <div key={category} className="space-y-3">
                  <h4 className="text-sm font-medium capitalize text-muted-foreground">
                    {category === "contact" && "Contato"}
                    {category === "deal" && "Negócio"}
                    {category === "organization" && "Organização"}
                    {category === "custom" && "Personalizados"}
                    {!["contact", "deal", "organization", "custom"].includes(category) && category}
                  </h4>
                  
                  {vars.map((variable) => (
                    <div key={variable.variable_key} className="space-y-1">
                      <Label className="text-xs flex items-center gap-2">
                        <code className="text-primary bg-primary/10 px-1 rounded">
                          {`{{${variable.variable_key}}}`}
                        </code>
                        <span className="text-muted-foreground">{variable.display_name}</span>
                      </Label>
                      <Input
                        value={sampleData[variable.variable_key] || ""}
                        onChange={(e) => handleUpdateSampleData(variable.variable_key, e.target.value)}
                        placeholder={variable.sample_value || ""}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              ))}

              {/* Fallback if no variables from DB */}
              {Object.keys(groupedVariables).length === 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Variáveis Padrão</h4>
                  
                  {Object.entries(defaultSampleData).map(([key, defaultValue]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">
                        <code className="text-primary bg-primary/10 px-1 rounded">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
