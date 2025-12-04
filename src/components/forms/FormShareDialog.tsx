import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, Link2, Code, Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormShareDialogProps {
  formId: string;
  formName: string;
  trigger?: React.ReactNode;
}

export function FormShareDialog({ formId, formName, trigger }: FormShareDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = window.location.origin;
  const directLink = `${baseUrl}/f/${formId}`;
  
  const iframeCode = `<iframe 
  src="${directLink}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="${formName}"
></iframe>`;

  const scriptCode = `<!-- Formulário: ${formName} -->
<div id="form-container-${formId.slice(0, 8)}"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${directLink}';
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    document.getElementById('form-container-${formId.slice(0, 8)}').appendChild(iframe);
  })();
</script>`;

  const handleCopy = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copiado!",
      description: `${type === "link" ? "Link" : "Código"} copiado para a área de transferência.`,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhar Formulário
          </DialogTitle>
          <DialogDescription>
            Copie o link direto ou o código para incorporar em seu site.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              Link Direto
            </TabsTrigger>
            <TabsTrigger value="embed" className="gap-2">
              <Code className="h-4 w-4" />
              Incorporar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Link do formulário</Label>
              <div className="flex gap-2">
                <Input value={directLink} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(directLink, "link")}
                >
                  {copied === "link" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(directLink, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhe este link por e-mail, WhatsApp ou redes sociais.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Código HTML (iframe)</Label>
              <div className="relative">
                <Textarea
                  value={iframeCode}
                  readOnly
                  rows={6}
                  className="font-mono text-xs resize-none pr-12"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={() => handleCopy(iframeCode, "iframe")}
                >
                  {copied === "iframe" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole este código no HTML do seu WordPress, Shopify ou qualquer site.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Código JavaScript (avançado)</Label>
              <div className="relative">
                <Textarea
                  value={scriptCode}
                  readOnly
                  rows={8}
                  className="font-mono text-xs resize-none pr-12"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={() => handleCopy(scriptCode, "script")}
                >
                  {copied === "script" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Versão com carregamento dinâmico para melhor performance.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}