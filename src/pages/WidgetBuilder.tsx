import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDepartments } from "@/hooks/useDepartments";
import { Copy, Check, Code2, Palette, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WidgetPreview from "@/components/WidgetPreview";

export default function WidgetBuilder() {
  const { data: departments } = useDepartments();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Widget Configuration State
  const [config, setConfig] = useState({
    color: "#2563EB",
    position: "right" as "right" | "left",
    greeting: "Posso ajudar?",
    department: "",
    logo: "",
    showWhatsApp: true,
    showTicket: true,
  });

  const activeDepartments = departments?.filter(d => d.is_active) || [];

  const generateScript = () => {
    const baseUrl = window.location.origin;
    const attrs = [
      `src="${baseUrl}/public-chat-widget.js"`,
      `data-color="${config.color}"`,
      `data-position="${config.position}"`,
      `data-greeting="${config.greeting}"`,
      config.department && config.department !== "none" ? `data-dept="${config.department}"` : "",
      config.logo ? `data-logo="${config.logo}"` : "",
      `data-show-whatsapp="${config.showWhatsApp}"`,
      `data-show-ticket="${config.showTicket}"`,
    ].filter(Boolean);

    return `<script\n  ${attrs.join("\n  ")}\n></script>`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateScript());
    setCopied(true);
    toast({
      title: "Código copiado!",
      description: "Cole no seu site antes do </body>",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Code2 className="h-8 w-8 text-primary" />
          Widget Builder
        </h1>
        <p className="text-muted-foreground mt-2">
          Personalize e gere o código do chat para seu site
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Panel - Configuration (40%) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Aparência
              </CardTitle>
              <CardDescription>Personalize cores e posição</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="color">Cor Principal</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={config.color}
                    onChange={(e) => setConfig({ ...config, color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={config.color}
                    onChange={(e) => setConfig({ ...config, color: e.target.value })}
                    className="flex-1"
                    placeholder="#2563EB"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Posição do Widget</Label>
                <Select
                  value={config.position}
                  onValueChange={(value: "right" | "left") => setConfig({ ...config, position: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Direita</SelectItem>
                    <SelectItem value="left">Esquerda</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="greeting">Frase de Chamada</Label>
                <Input
                  id="greeting"
                  value={config.greeting}
                  onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
                  placeholder="Posso ajudar?"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">URL do Logo (opcional)</Label>
                <Input
                  id="logo"
                  value={config.logo}
                  onChange={(e) => setConfig({ ...config, logo: e.target.value })}
                  placeholder="https://seu-site.com/logo.png"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Configuração de Negócio
              </CardTitle>
              <CardDescription>Departamento e canais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department">Departamento Padrão</Label>
                <Select
                  value={config.department || "none"}
                  onValueChange={(value) => setConfig({ ...config, department: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum (usuário escolhe)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (usuário escolhe)</SelectItem>
                    {activeDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-whatsapp">Mostrar WhatsApp</Label>
                <Switch
                  id="show-whatsapp"
                  checked={config.showWhatsApp}
                  onCheckedChange={(checked) => setConfig({ ...config, showWhatsApp: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-ticket">Mostrar Ticket</Label>
                <Switch
                  id="show-ticket"
                  checked={config.showTicket}
                  onCheckedChange={(checked) => setConfig({ ...config, showTicket: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Código Gerado</CardTitle>
              <CardDescription>Cole este código no seu site antes do {"</body>"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 text-green-400 p-4 rounded-md font-mono text-sm overflow-x-auto">
                <pre>{generateScript()}</pre>
              </div>
              <Button onClick={copyToClipboard} className="w-full mt-4">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Código
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Preview (60%) */}
        <div className="lg:col-span-3">
          <Card className="h-[800px]">
            <CardHeader>
              <CardTitle>Preview em Tempo Real</CardTitle>
              <CardDescription>Veja como o widget vai aparecer no seu site</CardDescription>
            </CardHeader>
            <CardContent className="h-[calc(100%-80px)]">
              <WidgetPreview config={config} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
