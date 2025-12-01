import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePersonas } from "@/hooks/usePersonas";
import { useSandboxChat, SandboxMessage, CustomerContext } from "@/hooks/useSandboxChat";
import { useCreateRLHFFeedback } from "@/hooks/useCreateRLHFFeedback";
import { useScenarioConfigs } from "@/hooks/useTrainingExamples";
import { SaveTrainingDialog } from "./SaveTrainingDialog";
import { PreChatForm } from "@/components/PreChatForm";
import { Bot, Send, Trash2, Activity, Zap, ThumbsUp, ThumbsDown, Database, Brain, UserCheck, Play, Star, GraduationCap, Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function SandboxTest() {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [feedbackGiven, setFeedbackGiven] = useState<Set<number>>(new Set());
  const [simulateRealFlow, setSimulateRealFlow] = useState(false);
  const [showPreChatForm, setShowPreChatForm] = useState(false);
  const [identifiedCustomer, setIdentifiedCustomer] = useState<CustomerContext | null>(null);
  const [selectedScenario, setSelectedScenario] = useState("normal");
  const [saveTrainingOpen, setSaveTrainingOpen] = useState(false);
  const [trainingData, setTrainingData] = useState<{ userMessage: string; assistantMessage: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 🎓 MODO TREINAMENTO
  const [trainingMode, setTrainingMode] = useState(false);
  const [correctingMessage, setCorrectingMessage] = useState<number | null>(null);
  const [correctionText, setCorrectionText] = useState("");

  const { data: personas } = usePersonas();
  const { data: scenarios } = useScenarioConfigs();
  const { 
    messages, 
    isLoading, 
    debugInfo, 
    sendMessage, 
    clearChat,
    useKnowledgeBase,
    setUseKnowledgeBase,
    aiProvider,
    setAiProvider,
    customerContext,
    setCustomerContext
  } = useSandboxChat();
  const createFeedback = useCreateRLHFFeedback();

  const selectedPersona = personas?.find(p => p.id === selectedPersonaId);

  const handleSaveAsTraining = (messageIndex: number) => {
    const userMessage = messages[messageIndex - 1];
    const assistantMessage = messages[messageIndex];
    
    if (userMessage && assistantMessage && assistantMessage.role === "assistant" && selectedPersonaId) {
      setTrainingData({
        userMessage: userMessage.content,
        assistantMessage: assistantMessage.content
      });
      setSaveTrainingOpen(true);
    }
  };

  const handleFeedback = async (
    messageIndex: number,
    message: SandboxMessage,
    feedbackType: "positive" | "negative"
  ) => {
    if (!selectedPersonaId || feedbackGiven.has(messageIndex)) return;

    // Find the previous user message for context
    const userMessageIndex = messageIndex - 1;
    const userMessage = messages[userMessageIndex];

    if (!userMessage || userMessage.role !== "user") {
      toast.error("Não foi possível encontrar a mensagem do usuário");
      return;
    }

    await createFeedback.mutateAsync({
      personaId: selectedPersonaId,
      messageContent: message.content,
      userMessage: userMessage.content,
      feedbackType,
      toolCalls: message.tool_calls || [],
    });

    setFeedbackGiven((prev) => new Set(prev).add(messageIndex));
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedPersonaId) return;
    
    // 🎓 DETECTAR COMANDO /APRENDER
    if (input.trim().startsWith('/aprender:')) {
      const ruleContent = input.trim().substring(10).trim();
      if (!ruleContent) {
        toast.error('Digite a regra após /aprender:');
        return;
      }
      
      try {
        const { error } = await supabase.functions.invoke('train-ai-pair', {
          body: {
            question: 'Comando de treinamento direto',
            correctAnswer: ruleContent,
            personaId: selectedPersonaId,
            source: 'sandbox_command',
          },
        });

        if (error) throw error;

        toast.success('🎓 Regra gravada e memorizada!');
        setInput('');
        
        return;
      } catch (error: any) {
        toast.error('Erro ao salvar regra: ' + error.message);
        return;
      }
    }
    
    const scenarioConfig = scenarios?.find(s => s.name.toLowerCase() === selectedScenario.toLowerCase());
    const messageWithScenario = scenarioConfig?.system_instruction 
      ? `${input}\n\n[SCENARIO_INSTRUCTION: ${scenarioConfig.system_instruction}]`
      : input;

    await sendMessage(messageWithScenario, selectedPersonaId, identifiedCustomer || undefined);
    setInput("");
  };

  const handleStartSimulation = () => {
    if (simulateRealFlow) {
      setShowPreChatForm(true);
    } else {
      // Limpar identificação e começar direto
      setIdentifiedCustomer(null);
      setCustomerContext(null);
    }
  };

  // 🎓 FUNÇÃO: Salvar Correção
  const handleCorrection = async (messageIndex: number) => {
    if (!correctionText.trim() || !selectedPersonaId) return;

    const userMessage = messages[messageIndex - 1];
    
    if (!userMessage || userMessage.role !== 'user') {
      toast.error('Mensagem do usuário não encontrada');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('train-ai-pair', {
        body: {
          question: userMessage.content,
          correctAnswer: correctionText,
          personaId: selectedPersonaId,
          source: 'sandbox_training',
        },
      });

      if (error) throw error;

      toast.success('🎓 IA aprendeu! Nunca mais vai errar isso.');
      setCorrectingMessage(null);
      setCorrectionText('');
    } catch (error: any) {
      toast.error('Erro ao treinar: ' + error.message);
    }
  };

  // 🎓 FUNÇÃO: Marcar Como Correto
  const handleMarkCorrect = (messageIndex: number) => {
    toast.success('✅ Resposta marcada como correta!');
    setFeedbackGiven((prev) => new Set(prev).add(messageIndex));
  };

  const handleCustomerIdentified = async (contact: any, _departmentId: string) => {
    const context: CustomerContext = {
      contact_id: contact.id,
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      status: contact.status,
    };
    
    setIdentifiedCustomer(context);
    setCustomerContext(context);
    setShowPreChatForm(false);
    
    toast.success(`✅ Cliente identificado: ${contact.first_name} ${contact.last_name}`);
  };

  const handleNewLeadIdentified = async (data: any, _departmentId: string) => {
    const context: CustomerContext = {
      contact_id: 'new_lead',
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      status: 'lead',
    };
    
    setIdentifiedCustomer(context);
    setCustomerContext(context);
    setShowPreChatForm(false);
    
    toast.success(`✅ Novo lead identificado: ${data.first_name} ${data.last_name}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show PreChatForm if simulation mode is active
  if (showPreChatForm) {
    return (
      <PreChatForm
        onExistingCustomerVerified={handleCustomerIdentified}
        onNewLeadCreated={handleNewLeadIdentified}
        isLoading={isLoading}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      {/* Main Chat Area - 2/3 width on large screens */}
      <div className="lg:col-span-2 space-y-4">
        {/* Persona Selector */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Selecionar Persona para Testar</h3>
              </div>
              {selectedPersona && (
                <Badge variant="default">{selectedPersona.name}</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {personas?.map((persona) => (
                <Button
                  key={persona.id}
                  variant={selectedPersonaId === persona.id ? "default" : "outline"}
                  onClick={() => setSelectedPersonaId(persona.id)}
                  className="flex-1 sm:flex-none"
                >
                  {persona.name}
                </Button>
              ))}
            </div>
            
            <Separator />
            
            {/* Configuration Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="sim-toggle" className="cursor-pointer">
                    Simular Fluxo Real (OTP + Identificação)
                  </Label>
                </div>
                <Switch
                  id="sim-toggle"
                  checked={simulateRealFlow}
                  onCheckedChange={(checked) => {
                    setSimulateRealFlow(checked);
                    if (!checked) {
                      setIdentifiedCustomer(null);
                      setCustomerContext(null);
                    }
                  }}
                />
              </div>

              {simulateRealFlow && !identifiedCustomer && (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={handleStartSimulation}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Identificação
                </Button>
              )}

              {identifiedCustomer && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">
                        {identifiedCustomer.first_name} {identifiedCustomer.last_name}
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        {identifiedCustomer.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="kb-toggle" className="cursor-pointer">
                    Usar Base de Conhecimento
                  </Label>
                </div>
                <Switch
                  id="kb-toggle"
                  checked={useKnowledgeBase}
                  onCheckedChange={setUseKnowledgeBase}
                />
              </div>

              <div className="space-y-2">
                <Label>🎭 Cenário do Cliente</Label>
                <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cenário" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios?.map((scenario) => (
                      <SelectItem key={scenario.id} value={scenario.name.toLowerCase()}>
                        {scenario.icon} {scenario.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {scenarios?.find(s => s.name.toLowerCase() === selectedScenario)?.description}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <Label className="cursor-pointer">Provider de IA</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={aiProvider === 'lovable' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAiProvider('lovable')}
                  >
                    Lovable AI
                  </Button>
                  <Button
                    variant={aiProvider === 'openai' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAiProvider('openai')}
                  >
                    OpenAI
                  </Button>
                </div>
              </div>
              
              {/* 🎓 MODO TREINAMENTO */}
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-purple-600" />
                  <Label htmlFor="training-toggle" className="cursor-pointer font-medium">
                    🎓 Modo Treinamento (Professor)
                  </Label>
                </div>
                <Switch
                  id="training-toggle"
                  checked={trainingMode}
                  onCheckedChange={setTrainingMode}
                />
              </div>
              
              {trainingMode && (
                <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                  <p className="text-xs text-purple-900 dark:text-purple-100">
                    💡 <strong>Modo Professor ativo:</strong> Cada resposta da IA terá botões [✅ Correto] e [✏️ Corrigir]. Use para ensinar a IA imediatamente.
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    Você também pode usar o comando <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">/aprender: sua regra aqui</code>
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Chat Messages */}
        <Card className="flex flex-col h-[calc(100vh-24rem)]">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Sandbox de Testes</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              disabled={messages.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Selecione uma persona e comece a testar
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="p-2 rounded-full bg-primary/10 h-fit">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2 max-w-[80%]">
                      <div
                        className={cn(
                          "rounded-lg px-4 py-3",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                        {message.tool_calls && message.tool_calls.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Zap className="h-3 w-3" />
                              <span className="font-medium">Tools Chamadas:</span>
                            </div>
                            {message.tool_calls.map((tool: any, idx: number) => (
                              <div
                                key={idx}
                                className="text-xs bg-background/50 rounded p-2 space-y-1"
                              >
                                <p className="font-medium">{tool.function.name}</p>
                                <pre className="text-xs overflow-x-auto">
                                  {JSON.stringify(JSON.parse(tool.function.arguments), null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-xs opacity-60 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>

                      {/* Feedback buttons for assistant messages */}
                      {message.role === "assistant" && (
                        <div className="flex flex-col gap-2">
                          {/* 🎓 MODO TREINAMENTO: Botões de Correção */}
                          {trainingMode && !feedbackGiven.has(index) && (
                            <div className="flex gap-2 p-2 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-green-500 text-green-700 hover:bg-green-50"
                                onClick={() => handleMarkCorrect(index)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Correto
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-orange-500 text-orange-700 hover:bg-orange-50"
                                onClick={() => {
                                  setCorrectingMessage(index);
                                  setCorrectionText('');
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Corrigir
                              </Button>
                            </div>
                          )}
                          
                          {/* Campo de correção */}
                          {correctingMessage === index && (
                            <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800 space-y-2">
                              <Label className="text-sm font-medium">✏️ Digite a resposta correta:</Label>
                              <textarea
                                className="w-full min-h-[100px] p-2 text-sm border rounded-md resize-vertical"
                                placeholder="Digite como a IA deveria ter respondido..."
                                value={correctionText}
                                onChange={(e) => setCorrectionText(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleCorrection(index)}
                                  disabled={!correctionText.trim()}
                                >
                                  <GraduationCap className="h-4 w-4 mr-1" />
                                  Salvar Regra
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCorrectingMessage(null);
                                    setCorrectionText('');
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Botões de feedback normais */}
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 px-2",
                                feedbackGiven.has(index) && "opacity-50"
                              )}
                              onClick={() => handleFeedback(index, message, "positive")}
                              disabled={feedbackGiven.has(index)}
                            >
                              <ThumbsUp className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 px-2",
                                feedbackGiven.has(index) && "opacity-50"
                              )}
                              onClick={() => handleFeedback(index, message, "negative")}
                              disabled={feedbackGiven.has(index)}
                            >
                              <ThumbsDown className="h-4 w-4 text-red-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleSaveAsTraining(index)}
                              title="Salvar como exemplo de treinamento"
                            >
                              <Star className="h-4 w-4 text-yellow-500" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="p-2 rounded-full bg-primary/10 h-fit">
                        <span className="text-sm font-medium">👤</span>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="p-2 rounded-full bg-primary/10 h-fit">
                      <Bot className="h-5 w-5 text-primary animate-pulse" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <p className="text-sm text-muted-foreground">Pensando...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder={
                  selectedPersonaId
                    ? "Digite sua mensagem..."
                    : "Selecione uma persona primeiro"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!selectedPersonaId || isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || !selectedPersonaId || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Debug Panel - 1/3 width on large screens */}
      <div className="space-y-4">
        {/* Persona Info */}
        {selectedPersona && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Persona Ativa</h3>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Nome:</p>
                <p className="font-medium">{selectedPersona.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Role:</p>
                <p className="font-medium">{selectedPersona.role}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Temperature:</p>
                <p className="font-medium">{selectedPersona.temperature}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Max Tokens:</p>
                <p className="font-medium">{selectedPersona.max_tokens}</p>
              </div>
              <div>
                <p className="text-muted-foreground">System Prompt:</p>
                <p className="text-xs bg-muted p-2 rounded mt-1 line-clamp-4">
                  {selectedPersona.system_prompt}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Customer Context Debug */}
        {debugInfo?.customer_context && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold">🔐 Identificação</h3>
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Nome:</p>
                <p className="font-medium">
                  {debugInfo.customer_context.first_name} {debugInfo.customer_context.last_name}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Email:</p>
                <p className="font-medium text-xs">{debugInfo.customer_context.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status:</p>
                <Badge variant={debugInfo.customer_context.status === 'customer' ? 'default' : 'secondary'}>
                  {debugInfo.customer_context.status}
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Tool Execution Results */}
        {debugInfo?.tools_executed && debugInfo.tools_executed.length > 0 && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold">⚡ Tools Executadas</h3>
            </div>
            <Separator />
            <div className="space-y-3">
              {debugInfo.tools_executed.map((tool: any, idx: number) => (
                <div key={idx} className="bg-muted p-3 rounded text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{tool.tool_name}</p>
                    <Badge variant={tool.success ? 'default' : 'destructive'}>
                      {tool.success ? '✓ Sucesso' : '✗ Falhou'}
                    </Badge>
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground">Argumentos:</p>
                    <pre className="bg-background p-2 rounded overflow-x-auto">
                      {JSON.stringify(tool.arguments, null, 2)}
                    </pre>
                    {tool.result && (
                      <>
                        <p className="text-muted-foreground mt-2">Resultado:</p>
                        <pre className="bg-background p-2 rounded overflow-x-auto">
                          {JSON.stringify(tool.result, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Debug Info */}
        {debugInfo && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Debug Info</h3>
            </div>
            <Separator />
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Model:</p>
                <p className="font-medium text-xs">{debugInfo.model}</p>
              </div>
              
              <div>
                <p className="text-muted-foreground">Provider:</p>
                <Badge variant={debugInfo.ai_provider === 'openai' ? 'default' : 'secondary'}>
                  {debugInfo.ai_provider === 'openai' ? 'OpenAI' : 'Lovable AI'}
                </Badge>
              </div>
              
              <div>
                <p className="text-muted-foreground">Intent:</p>
                <Badge variant={debugInfo.intent_classification === 'skip' ? 'secondary' : 'default'}>
                  {debugInfo.intent_classification === 'skip' ? '⚡ Skip KB' : '🔍 Search KB'}
                </Badge>
              </div>
              
              {debugInfo.queries_executed && debugInfo.queries_executed.length > 1 && (
                <div>
                  <p className="text-muted-foreground text-xs">Query Expansion:</p>
                  <div className="bg-muted p-2 rounded mt-1">
                    <ul className="text-xs space-y-1">
                      {debugInfo.queries_executed.map((q: string, i: number) => (
                        <li key={i} className="truncate">
                          {i === 0 ? '🎯' : '🔄'} {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {debugInfo.knowledge_search_performed && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-green-500" />
                    <p className="text-muted-foreground">
                      Base: <span className="font-medium text-green-500">
                        {debugInfo.semantic_search_used ? 'Semantic' : 'Keyword'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Artigos Encontrados:</p>
                    <p className="font-medium">{debugInfo.articles_found}</p>
                  </div>
                  {debugInfo.articles && debugInfo.articles.length > 0 && (
                    <div className="bg-muted p-2 rounded">
                      <p className="text-xs font-medium mb-1">Artigos Usados:</p>
                      <ul className="text-xs space-y-1">
                        {debugInfo.articles.map((article: any) => (
                          <li key={article.id} className="truncate">
                            • {article.title} 
                            {article.similarity && (
                              <span className="text-primary ml-1">({article.similarity})</span>
                            )}
                            <span className="text-muted-foreground"> [{article.category}]</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {debugInfo.persona_categories && debugInfo.persona_categories.length > 0 && (
                    <div>
                      <p className="text-muted-foreground text-xs">Categorias da Persona:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {debugInfo.persona_categories.map((cat: string) => (
                          <Badge key={cat} variant="outline" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {debugInfo.handoff_triggered && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🚨</span>
                    <p className="font-semibold text-destructive">Handoff Triggered</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reason: {debugInfo.handoff_reason === 'customer_requested_human' 
                      ? 'Customer requested human agent' 
                      : 'Knowledge gap detected'}
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-muted-foreground">Execution Time:</p>
                <p className="font-medium">{debugInfo.execution_time_ms}ms</p>
              </div>
              
              <div>
                <p className="text-muted-foreground">Tokens:</p>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div className="bg-muted p-2 rounded text-center">
                    <p className="text-xs text-muted-foreground">Prompt</p>
                    <p className="font-medium">{debugInfo.prompt_tokens}</p>
                  </div>
                  <div className="bg-muted p-2 rounded text-center">
                    <p className="text-xs text-muted-foreground">Response</p>
                    <p className="font-medium">{debugInfo.completion_tokens}</p>
                  </div>
                  <div className="bg-primary/10 p-2 rounded text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-medium">{debugInfo.total_tokens}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tips */}
        <Card className="p-4 space-y-2">
          <h4 className="font-semibold text-sm">💡 Dicas de Teste</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Teste diferentes tons e estilos de conversa</li>
            <li>• Verifique se as tools são chamadas corretamente</li>
            <li>• Observe o consumo de tokens no debug</li>
            <li>• Teste cenários de erro e edge cases</li>
          </ul>
        </Card>
      </div>

      {trainingData && selectedPersonaId && (
        <SaveTrainingDialog
          open={saveTrainingOpen}
          onOpenChange={setSaveTrainingOpen}
          personaId={selectedPersonaId}
          userMessage={trainingData.userMessage}
          assistantMessage={trainingData.assistantMessage}
        />
      )}
    </div>
  );
}
