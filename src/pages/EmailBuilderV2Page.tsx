import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Settings, FlaskConical, LayoutTemplate, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmailTemplateBuilderV2,
  ABTestingPanel,
  LayoutLibrary,
  PreviewPanel,
  SendTestEmailDialog,
} from "@/components/email-builder-v2";
import {
  useEmailTemplateV2,
  useEmailBlocks,
  useSaveEmailBlocks,
  useUpdateEmailTemplateV2,
} from "@/hooks/useEmailBuilderV2";
import type { EmailBlock } from "@/types/emailBuilderV2";
import { useToast } from "@/hooks/use-toast";

export default function EmailBuilderV2Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: template, isLoading: templateLoading } = useEmailTemplateV2(id || "");
  const { data: blocks, isLoading: blocksLoading } = useEmailBlocks(id || "");
  const saveBlocks = useSaveEmailBlocks();
  const updateTemplate = useUpdateEmailTemplateV2();
  
  const [layoutLibraryOpen, setLayoutLibraryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");
  const [currentBlocks, setCurrentBlocks] = useState<EmailBlock[]>([]);

  // Track blocks changes for preview
  const displayBlocks = currentBlocks.length > 0 ? currentBlocks : (blocks as unknown as EmailBlock[]) || [];

  const handleSaveBlocks = async (newBlocks: EmailBlock[]) => {
    if (!id) return;
    
    // Update local state for live preview
    setCurrentBlocks(newBlocks);
    
    try {
      await saveBlocks.mutateAsync({ templateId: id, blocks: newBlocks });
      toast({
        title: "Template salvo",
        description: "Os blocos foram salvos com sucesso",
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleBlocksChange = (newBlocks: EmailBlock[]) => {
    setCurrentBlocks(newBlocks);
  };

  const handleToggleABTesting = async (enabled: boolean) => {
    if (!id) return;
    
    try {
      await updateTemplate.mutateAsync({
        id,
        updates: { ab_testing_enabled: enabled },
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleSelectLayout = (layoutBlocks: Omit<EmailBlock, "id" | "template_id">[]) => {
    if (!id) return;
    
    // Mapear 'type' para 'block_type' (layouts no DB usam 'type')
    const blocksWithIds: EmailBlock[] = layoutBlocks.map((block: any, index) => ({
      ...block,
      block_type: block.block_type || block.type, // Suportar ambos os formatos
      id: `block-${Date.now()}-${index}`,
      template_id: id,
      position: index,
    } as EmailBlock));
    
    handleSaveBlocks(blocksWithIds);
  };

  if (templateLoading || blocksLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Carregando editor...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Template não encontrado</p>
        <Button onClick={() => navigate("/email-templates")}>
          Voltar para Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/email-templates")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{template.name}</h1>
              <p className="text-sm text-muted-foreground">
                {template.category} • v{template.version || 1}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <PreviewPanel
              blocks={displayBlocks}
              subject={template.default_subject}
              preheader={template.default_preheader}
            />
            <SendTestEmailDialog
              templateId={id || ""}
              blocks={displayBlocks}
              subject={template.default_subject}
              preheader={template.default_preheader}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLayoutLibraryOpen(true)}
            >
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Layouts
            </Button>
          </div>
        </div>

        {/* Migrated Template Warning */}
        {template.name.includes("(Migrado)") && (
          <Alert className="mx-4 mt-2 bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              Este template foi migrado e usa HTML customizado. Use o modo "Editar" no bloco para modificar visualmente, 
              ou recrie usando a biblioteca de layouts para edição por blocos.
            </AlertDescription>
          </Alert>
        )}

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <EmailTemplateBuilderV2
            templateId={id}
            initialBlocks={(blocks as unknown as EmailBlock[]) || []}
            onSave={handleSaveBlocks}
            isSaving={saveBlocks.isPending}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 border-l bg-card flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="editor"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <Settings className="h-4 w-4 mr-2" />
              Config
            </TabsTrigger>
            <TabsTrigger
              value="ab-testing"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              <FlaskConical className="h-4 w-4 mr-2" />
              A/B
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="editor" className="p-4 m-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input
                    value={template.default_subject || ""}
                    placeholder="Assunto do email..."
                    onChange={(e) => {
                      if (id) {
                        updateTemplate.mutate({
                          id,
                          updates: { default_subject: e.target.value },
                        });
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Preheader</Label>
                  <Input
                    value={template.default_preheader || ""}
                    placeholder="Texto de prévia..."
                    onChange={(e) => {
                      if (id) {
                        updateTemplate.mutate({
                          id,
                          updates: { default_preheader: e.target.value },
                        });
                      }
                    }}
                  />
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">Informações</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Categoria</span>
                      <span>{template.category || "—"}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Gatilho</span>
                      <Select
                        value={template.trigger_type || "manual"}
                        onValueChange={(value) => {
                          if (id) {
                            updateTemplate.mutate({
                              id,
                              updates: { trigger_type: value },
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="deal_created">Negócio Criado</SelectItem>
                          <SelectItem value="deal_won">Negócio Ganho</SelectItem>
                          <SelectItem value="deal_lost">Negócio Perdido</SelectItem>
                          <SelectItem value="ticket_created">Ticket Criado</SelectItem>
                          <SelectItem value="ticket_resolved">Ticket Resolvido</SelectItem>
                          <SelectItem value="contact_created">Contato Criado</SelectItem>
                          <SelectItem value="playbook_step">Etapa de Playbook</SelectItem>
                          <SelectItem value="form_submission">Envio de Formulário</SelectItem>
                          {/* Kiwify */}
                          <SelectItem value="order_paid">Kiwify - Compra Aprovada</SelectItem>
                          <SelectItem value="upsell_paid">Kiwify - Upsell Aprovado</SelectItem>
                          <SelectItem value="subscription_renewed">Kiwify - Assinatura Renovada</SelectItem>
                          <SelectItem value="refunded">Kiwify - Reembolso</SelectItem>
                          <SelectItem value="churned">Kiwify - Cancelamento/Churn</SelectItem>
                          <SelectItem value="cart_abandoned">Kiwify - Carrinho Abandonado</SelectItem>
                          <SelectItem value="payment_refused">Kiwify - Pagamento Recusado</SelectItem>
                          <SelectItem value="subscription_late">Kiwify - Assinatura Atrasada</SelectItem>
                          <SelectItem value="subscription_card_declined">Kiwify - Cartão Recusado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Versão</span>
                      <span>v{template.version || 1}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>


            <TabsContent value="ab-testing" className="p-4 m-0">
              <ABTestingPanel
                templateId={id || ""}
                abTestingEnabled={template.ab_testing_enabled || false}
                onToggleABTesting={handleToggleABTesting}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Layout Library Dialog */}
      <LayoutLibrary
        open={layoutLibraryOpen}
        onOpenChange={setLayoutLibraryOpen}
        onSelectLayout={handleSelectLayout}
      />
    </div>
  );
}
