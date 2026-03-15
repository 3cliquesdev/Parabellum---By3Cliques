import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreatePersona } from "@/hooks/useCreatePersona";
import { useUpdatePersona } from "@/hooks/useUpdatePersona";
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories";
import { TrainingExamplesTab } from "./TrainingExamplesTab";
import { TemperaturePreview } from "./settings/TemperaturePreview";

interface PersonaDialogProps {
  trigger: React.ReactNode;
  persona?: {
    id: string;
    name: string;
    role: string;
    system_prompt: string;
    temperature: number | null;
    max_tokens: number | null;
    knowledge_base_paths: string[] | null;
    is_active: boolean | null;
    use_priority_instructions: boolean | null;
  };
  onOpenChange?: (open: boolean) => void;
}

export function PersonaDialog({ trigger, persona, onOpenChange }: PersonaDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [usePriorityInstructions, setUsePriorityInstructions] = useState(false);
  const [hasGlobalAccess, setHasGlobalAccess] = useState(true);
  
  // Data Access Controls
  const [accessCustomerData, setAccessCustomerData] = useState(true);
  const [accessKnowledgeBase, setAccessKnowledgeBase] = useState(true);
  const [accessOrderHistory, setAccessOrderHistory] = useState(false);
  const [accessFinancialData, setAccessFinancialData] = useState(false);
  const [accessTrackingData, setAccessTrackingData] = useState(false);

  const createPersona = useCreatePersona();
  const updatePersona = useUpdatePersona();
  const { data: availableCategories = [], isLoading: loadingCategories } = useKnowledgeCategories();

  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setRole(persona.role);
      setSystemPrompt(persona.system_prompt);
      setTemperature(persona.temperature ?? 0.7);
      setMaxTokens(persona.max_tokens ?? 500);
      setSelectedCategories(persona.knowledge_base_paths ?? []);
      setIsActive(persona.is_active ?? true);
      setUsePriorityInstructions(persona.use_priority_instructions ?? false);
      setHasGlobalAccess(!persona.knowledge_base_paths || persona.knowledge_base_paths.length === 0);
      
      // Initialize data access from persona.data_access
      const dataAccess = (persona as any).data_access;
      setAccessCustomerData(dataAccess?.customer_data ?? true);
      setAccessKnowledgeBase(dataAccess?.knowledge_base ?? true);
      setAccessOrderHistory(dataAccess?.order_history ?? false);
      setAccessFinancialData(dataAccess?.financial_data ?? false);
      setAccessTrackingData(dataAccess?.tracking_data ?? false);
    } else {
      setName("");
      setRole("");
      setSystemPrompt("");
      setTemperature(0.7);
      setMaxTokens(500);
      setSelectedCategories([]);
      setIsActive(true);
      setUsePriorityInstructions(false);
      setHasGlobalAccess(true);
      
      // Reset data access to defaults
      setAccessCustomerData(true);
      setAccessKnowledgeBase(true);
      setAccessOrderHistory(false);
      setAccessFinancialData(false);
      setAccessTrackingData(false);
    }
  }, [persona, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name,
      role,
      system_prompt: systemPrompt,
      temperature,
      max_tokens: maxTokens,
      knowledge_base_paths: hasGlobalAccess ? null : (selectedCategories.length > 0 ? selectedCategories : null),
      is_active: isActive,
      use_priority_instructions: usePriorityInstructions,
      data_access: {
        customer_data: accessCustomerData,
        knowledge_base: accessKnowledgeBase,
        order_history: accessOrderHistory,
        financial_data: accessFinancialData,
        tracking_data: accessTrackingData,
      },
    };

    if (persona) {
      await updatePersona.mutateAsync({ id: persona.id, data });
    } else {
      await createPersona.mutateAsync(data);
    }

    setOpen(false);
    onOpenChange?.(false);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      onOpenChange?.(isOpen);
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{persona ? "Editar Persona" : "Nova Persona"}</DialogTitle>
          <DialogDescription>
            Configure o comportamento e conhecimento da IA para diferentes contextos
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="config">⚙️ Configuração</TabsTrigger>
            <TabsTrigger value="training" disabled={!persona}>
              🎓 Exemplos de Treinamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 mt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Persona</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Hunter, Helper"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Papel/Função</Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Ex: Assistente de Vendas, Suporte Técnico"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Descreva a personalidade e comportamento da IA..."
              className="min-h-[120px]"
              required
            />
          </div>

          <TemperaturePreview value={temperature} onChange={setTemperature} />

          <div className="space-y-2">
            <Label htmlFor="maxTokens">Max Tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              min="50"
              max="4000"
              step="50"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Limite de resposta</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1">
                <Label htmlFor="global-access" className="text-base">
                  🌐 Acesso Global à Base de Conhecimento
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, a persona pode acessar TODOS os artigos
                </p>
              </div>
              <Switch
                id="global-access"
                checked={hasGlobalAccess}
                onCheckedChange={(checked) => {
                  setHasGlobalAccess(checked);
                  if (checked) setSelectedCategories([]);
                }}
              />
            </div>

            {!hasGlobalAccess && (
              <>
                <div>
                  <Label>🔒 Categorias Permitidas</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selecione quais categorias esta persona pode consultar
                  </p>
                </div>
                
                {loadingCategories ? (
                  <p className="text-sm text-muted-foreground">Carregando categorias...</p>
                ) : availableCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada. Crie artigos primeiro.</p>
                ) : (
                  <div className="border rounded-lg p-4 space-y-2 max-h-[180px] overflow-y-auto">
                    {availableCategories.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={() => toggleCategory(category)}
                        />
                        <Label
                          htmlFor={`category-${category}`}
                          className="cursor-pointer"
                        >
                          {category}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedCategories.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    ✅ {selectedCategories.length} categoria(s) selecionada(s): {selectedCategories.join(", ")}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="isActive">Persona Ativa</Label>
              <p className="text-sm text-muted-foreground">Permitir uso em conversações</p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <div className="flex-1">
              <Label htmlFor="usePriorityInstructions" className="flex items-center gap-2">
                🔐 Instruções Prioritárias
                <span className="text-xs font-normal text-amber-600 dark:text-amber-500">(Requer Autorização)</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Quando ativado, usa instruções personalizadas para boas-vindas e verificação OTP. 
                <span className="text-amber-600 dark:text-amber-500 font-medium"> Apenas Admin/Manager podem ativar.</span>
              </p>
            </div>
            <Switch
              id="usePriorityInstructions"
              checked={usePriorityInstructions}
              onCheckedChange={setUsePriorityInstructions}
            />
          </div>

          {/* NOVA SEÇÃO: ACESSO A DADOS */}
          <div className="space-y-4 p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
            <div>
              <Label className="text-base font-semibold text-blue-900 dark:text-blue-100">
                🔒 Controle de Acesso a Dados
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Configure quais informações esta IA pode acessar e exibir aos clientes
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border">
                <div>
                  <Label htmlFor="accessCustomerData" className="font-medium">
                    👤 Dados do Cliente
                  </Label>
                  <p className="text-xs text-muted-foreground">Nome, Email, Telefone, CPF</p>
                </div>
                <Switch
                  id="accessCustomerData"
                  checked={accessCustomerData}
                  onCheckedChange={setAccessCustomerData}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border">
                <div>
                  <Label htmlFor="accessKnowledgeBase" className="font-medium">
                    📚 Base de Conhecimento
                  </Label>
                  <p className="text-xs text-muted-foreground">Artigos e documentação</p>
                </div>
                <Switch
                  id="accessKnowledgeBase"
                  checked={accessKnowledgeBase}
                  onCheckedChange={setAccessKnowledgeBase}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border">
                <div>
                  <Label htmlFor="accessOrderHistory" className="font-medium">
                    📦 Histórico de Pedidos
                  </Label>
                  <p className="text-xs text-muted-foreground">Compras e transações</p>
                </div>
                <Switch
                  id="accessOrderHistory"
                  checked={accessOrderHistory}
                  onCheckedChange={setAccessOrderHistory}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border border-amber-300 dark:border-amber-700">
                <div>
                  <Label htmlFor="accessFinancialData" className="font-medium text-amber-700 dark:text-amber-400">
                    💰 Dados Financeiros
                  </Label>
                  <p className="text-xs text-muted-foreground">Saldo, transações, saques</p>
                </div>
                <Switch
                  id="accessFinancialData"
                  checked={accessFinancialData}
                  onCheckedChange={setAccessFinancialData}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded border border-orange-300 dark:border-orange-700">
                <div>
                  <Label htmlFor="accessTrackingData" className="font-medium text-orange-700 dark:text-orange-400">
                    🚚 Rastreio de Pedidos (MySQL)
                  </Label>
                  <p className="text-xs text-muted-foreground">Consulta status de entrega no romaneio</p>
                </div>
                <Switch
                  id="accessTrackingData"
                  checked={accessTrackingData}
                  onCheckedChange={setAccessTrackingData}
                />
              </div>
            </div>

            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              ⚠️ <strong>Atenção:</strong> Desabilitar acesso a dados pode limitar a capacidade da IA de responder perguntas específicas.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createPersona.isPending || updatePersona.isPending}>
              {persona ? "Salvar Alterações" : "Criar Persona"}
            </Button>
          </div>
        </form>
          </TabsContent>

          <TabsContent value="training">
            <TrainingExamplesTab personaId={persona?.id || null} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
