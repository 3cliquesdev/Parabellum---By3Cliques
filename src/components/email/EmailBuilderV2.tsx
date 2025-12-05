import { useRef, useState, useEffect } from "react";
import EmailEditor, { EditorRef, EmailEditorProps } from "react-email-editor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Monitor, Save, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmailBuilderV2Props {
  initialDesign?: any;
  initialHtml?: string;
  onSave: (data: { html: string; design: any }) => void;
  isSaving?: boolean;
}

export function EmailBuilderV2({ initialDesign, onSave, isSaving }: EmailBuilderV2Props) {
  const emailEditorRef = useRef<EditorRef>(null);
  const editorInstance = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [hasError, setHasError] = useState(false);

  const handleReady: EmailEditorProps["onReady"] = (unlayer) => {
    setIsReady(true);
    editorInstance.current = unlayer;
    
    // Carregar design existente
    if (initialDesign) {
      try {
        unlayer.loadDesign(initialDesign);
      } catch (err) {
        console.error("Erro ao carregar design:", err);
        setHasError(true);
      }
    }
  };

  // Trocar preview Desktop/Mobile
  useEffect(() => {
    if (editorInstance.current && isReady) {
      try {
        editorInstance.current.setDevice(previewMode);
      } catch (err) {
        console.error("Erro ao trocar dispositivo:", err);
      }
    }
  }, [previewMode, isReady]);

  const handleSave = () => {
    if (!editorInstance.current) return;
    
    editorInstance.current.exportHtml((data: { design: any; html: string }) => {
      const { design, html } = data;
      onSave({ html, design });
    });
  };

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar o editor de e-mail. Tente recarregar a página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as "desktop" | "mobile")}>
            <TabsList>
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="h-4 w-4" />
                Desktop
              </TabsTrigger>
              <TabsTrigger value="mobile" className="gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground ml-4">
            Use as variáveis: {"{{nome}}"}, {"{{email}}"}, {"{{telefone}}"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isReady && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando editor...
            </div>
          )}
          <Button onClick={handleSave} disabled={!isReady || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <EmailEditor
          ref={emailEditorRef}
          onReady={handleReady}
          minHeight="100%"
          options={{
            locale: "pt-BR",
            appearance: {
              theme: "modern_dark",
            },
            features: {
              textEditor: {
                tables: true,
                cleanPaste: true,
              },
            },
            tools: {
              button: { enabled: true },
              divider: { enabled: true },
              heading: { enabled: true },
              html: { enabled: true },
              image: { enabled: true },
              menu: { enabled: true },
              social: { enabled: true },
              text: { enabled: true },
              video: { enabled: true },
            },
            mergeTags: {
              nome: { name: "Nome", value: "{{nome}}" },
              email: { name: "E-mail", value: "{{email}}" },
              telefone: { name: "Telefone", value: "{{telefone}}" },
              empresa: { name: "Empresa", value: "{{empresa}}" },
              primeiro_nome: { name: "Primeiro Nome", value: "{{primeiro_nome}}" },
              sobrenome: { name: "Sobrenome", value: "{{sobrenome}}" },
              data: { name: "Data", value: "{{data}}" },
              ticket_numero: { name: "Número do Ticket", value: "{{ticket_numero}}" },
              assunto: { name: "Assunto", value: "{{assunto}}" },
            },
          }}
        />
      </div>
    </div>
  );
}
