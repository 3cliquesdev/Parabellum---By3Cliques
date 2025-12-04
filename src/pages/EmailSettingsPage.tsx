import { ArrowLeft, Mail, Palette, Send, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { EmailBrandingCard } from "@/components/settings/EmailBrandingCard";
import { EmailSendersCard } from "@/components/settings/EmailSendersCard";
import EmailConfigCard from "@/components/settings/EmailConfigCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EmailSettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configurações de Email
            </h1>
            <p className="text-sm text-muted-foreground">
              Central de autonomia para emails - Branding, Remetentes e Templates
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="senders" className="gap-2">
              <Send className="h-4 w-4" />
              Remetentes
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="domain" className="gap-2">
              <Mail className="h-4 w-4" />
              Domínio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6">
            <EmailBrandingCard />
          </TabsContent>

          <TabsContent value="senders" className="space-y-6">
            <EmailSendersCard />
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <div className="text-center py-8 border rounded-lg">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Templates de Email</h3>
              <p className="text-muted-foreground mb-4">
                Gerencie todos os templates de email do sistema
              </p>
              <Button onClick={() => navigate("/email-templates")}>
                Acessar Templates
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="domain" className="space-y-6">
            <EmailConfigCard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
