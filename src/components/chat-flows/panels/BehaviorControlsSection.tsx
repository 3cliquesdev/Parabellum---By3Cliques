import { useState, useEffect } from "react";
import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Shield,
  MessageSquareOff,
  ListX,
  Target,
  Info,
  LogOut,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  UserCheck,
  XCircle,
  HeadphonesIcon,
  Route,
  Briefcase,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BehaviorControlsSectionProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

function ExitKeywordsTextarea({ selectedNode, updateNodeData }: BehaviorControlsSectionProps) {
  const [exitText, setExitText] = useState(
    (selectedNode.data.exit_keywords || []).join("\n")
  );

  useEffect(() => {
    setExitText((selectedNode.data.exit_keywords || []).join("\n"));
  }, [selectedNode.id]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Palavras de saída</Label>
      <Textarea
        onKeyDown={(e) => e.stopPropagation()}
        value={exitText}
        onChange={(e) => setExitText(e.target.value)}
        onBlur={() => {
          const keywords = exitText.split("\n").map((k: string) => k.trim()).filter(Boolean);
          updateNodeData("exit_keywords", keywords);
        }}
        placeholder={"falar com atendente\nencerrar\nhumano"}
        rows={4}
        className="resize-y text-sm min-h-[80px] max-h-[200px] overflow-y-auto"
      />
      <p className="text-[10px] text-muted-foreground">
        Uma por linha. Se o cliente digitar uma dessas, o fluxo avança.
      </p>
    </div>
  );
}

export function BehaviorControlsSection({
  selectedNode,
  updateNodeData,
}: BehaviorControlsSectionProps) {
  const maxSentences = selectedNode.data.max_sentences ?? 3;
  const forbidQuestions = selectedNode.data.forbid_questions ?? true;
  const forbidOptions = selectedNode.data.forbid_options ?? true;
  const forbidFinancial = selectedNode.data.forbid_financial ?? false;
  const forbidCommercial = selectedNode.data.forbid_commercial ?? false;
  const forbidCancellation = selectedNode.data.forbid_cancellation ?? false;
  const forbidSupport = selectedNode.data.forbid_support ?? false;
  const forbidConsultant = selectedNode.data.forbid_consultant ?? false;
  const objective = selectedNode.data.objective || "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-purple-500" />
        <Label className="text-xs font-semibold uppercase tracking-wide">
          Como a IA deve responder
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                Configure como a IA vai se comportar neste ponto do fluxo.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Objetivo do Nó */}
      <div className="space-y-2 p-3 rounded-lg border bg-purple-500/5 border-purple-500/20">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-purple-500" />
          <Label className="text-sm font-medium">O que a IA deve fazer aqui</Label>
        </div>
        
        <Textarea
          onKeyDown={(e) => e.stopPropagation()}
          value={objective}
          onChange={(e) => updateNodeData("objective", e.target.value)}
          placeholder="Ex: Tirar dúvidas sobre entrega do pedido"
          rows={2}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground">
          A IA só vai falar sobre esse assunto.
        </p>
      </div>

      {/* Máximo de Frases */}
      <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Tamanho da resposta</Label>
          <Badge variant="secondary" className="text-xs px-2">
            {maxSentences} {maxSentences === 1 ? 'frase' : 'frases'}
          </Badge>
        </div>
        
        <Slider
          value={[maxSentences]}
          onValueChange={(value) => updateNodeData("max_sentences", value[0])}
          min={1}
          max={5}
          step={1}
          className="w-full"
        />
        
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Muito curta</span>
          <span>Detalhada</span>
        </div>
      </div>

      {/* Restrições de Comportamento */}
      <div className="space-y-3 p-3 rounded-lg border bg-red-500/5 border-red-500/20">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          O que a IA NÃO pode fazer
        </Label>

        {/* Não fazer perguntas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareOff className="h-4 w-4 text-red-400" />
            <div>
              <Label className="text-sm font-medium">Não fazer perguntas</Label>
              <p className="text-[10px] text-muted-foreground">
                A IA só responde, não pergunta nada
              </p>
            </div>
          </div>
          <Switch
            checked={forbidQuestions}
            onCheckedChange={(checked) => updateNodeData("forbid_questions", checked)}
          />
        </div>

        {/* Proibir Opções */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListX className="h-4 w-4 text-red-400" />
            <div>
              <Label className="text-sm font-medium">Não dar opções numeradas</Label>
              <p className="text-[10px] text-muted-foreground">
                A IA não oferece lista de opções (1, 2, 3...)
              </p>
            </div>
          </div>
          <Switch
            checked={forbidOptions}
            onCheckedChange={(checked) => updateNodeData("forbid_options", checked)}
          />
        </div>

        {/* Status das Restrições */}
        <div className="flex flex-wrap gap-1 pt-1">
          {forbidQuestions && (
            <Badge variant="destructive" className="text-[10px] px-1.5">
              Sem perguntas
            </Badge>
          )}
          {forbidOptions && (
            <Badge variant="destructive" className="text-[10px] px-1.5">
              Sem opções
            </Badge>
          )}
          {!forbidQuestions && !forbidOptions && (
            <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">
              Sem restrições ativas
            </Badge>
          )}
        </div>
      </div>

      {/* 🆕 Saídas automáticas por intenção */}
      <div className="space-y-3 p-3 rounded-lg border bg-blue-500/5 border-blue-500/20">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">
            Saídas automáticas por intenção
          </Label>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Ative para detectar intenções e direcionar pela saída correspondente no nó.
        </p>

        {/* 💰 Financeiro */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <div>
              <Label className="text-sm font-medium">💰 Financeiro</Label>
              <p className="text-[10px] text-muted-foreground">
                Saque, reembolso, estorno → saída amarela
              </p>
            </div>
          </div>
          <Switch
            checked={forbidFinancial}
            onCheckedChange={(checked) => updateNodeData("forbid_financial", checked)}
          />
        </div>

        {/* ❌ Cancelamento */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <div>
              <Label className="text-sm font-medium">❌ Cancelamento</Label>
              <p className="text-[10px] text-muted-foreground">
                Cancelar plano, desistir → saída vermelha
              </p>
            </div>
          </div>
          <Switch
            checked={forbidCancellation}
            onCheckedChange={(checked) => updateNodeData("forbid_cancellation", checked)}
          />
        </div>

        {/* 🛒 Comercial */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <Label className="text-sm font-medium">🛒 Comercial</Label>
              <p className="text-[10px] text-muted-foreground">
                Comprar, preço, proposta → saída verde
              </p>
            </div>
          </div>
          <Switch
            checked={forbidCommercial}
            onCheckedChange={(checked) => updateNodeData("forbid_commercial", checked)}
          />
        </div>

        {/* 🧑 Suporte */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
            <div>
              <Label className="text-sm font-medium">🧑 Suporte</Label>
              <p className="text-[10px] text-muted-foreground">
                Pedir atendente, falar com humano → saída azul
              </p>
            </div>
          </div>
          <Switch
            checked={forbidSupport}
            onCheckedChange={(checked) => updateNodeData("forbid_support", checked)}
          />
        </div>

        {/* 💼 Consultor */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500 shrink-0" />
            <div>
              <Label className="text-sm font-medium">💼 Consultor</Label>
              <p className="text-[10px] text-muted-foreground">
                Falar com consultor → saída roxa (só se tiver consultor vinculado)
              </p>
            </div>
          </div>
          <Switch
            checked={forbidConsultant}
            onCheckedChange={(checked) => updateNodeData("forbid_consultant", checked)}
          />
        </div>

        {/* Status das saídas ativas */}
        <div className="flex flex-wrap gap-1 pt-1">
          {forbidFinancial && (
            <Badge className="text-[10px] px-1.5 bg-amber-500/20 text-amber-700 border-amber-500/30">
              💰 Financeiro
            </Badge>
          )}
          {forbidCancellation && (
            <Badge className="text-[10px] px-1.5 bg-red-500/20 text-red-700 border-red-500/30">
              ❌ Cancelamento
            </Badge>
          )}
          {forbidCommercial && (
            <Badge className="text-[10px] px-1.5 bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
              🛒 Comercial
            </Badge>
          )}
          {forbidSupport && (
            <Badge className="text-[10px] px-1.5 bg-blue-500/20 text-blue-700 border-blue-500/30">
              🧑 Suporte
            </Badge>
          )}
          {forbidConsultant && (
            <Badge className="text-[10px] px-1.5 bg-violet-500/20 text-violet-700 border-violet-500/30">
              💼 Consultor
            </Badge>
          )}
          {!forbidFinancial && !forbidCancellation && !forbidCommercial && !forbidSupport && !forbidConsultant && (
            <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">
              Nenhuma saída ativa
            </Badge>
          )}
        </div>
      </div>

      {/* 🆕 Seção: Quando sair da IA */}
      <div className="space-y-3 p-3 rounded-lg border bg-indigo-500/5 border-indigo-500/20">
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-indigo-500" />
          <Label className="text-xs font-semibold uppercase tracking-wide">
            Quando sair da IA
          </Label>
        </div>

        <ExitKeywordsTextarea
          selectedNode={selectedNode}
          updateNodeData={updateNodeData}
        />

        {/* Máximo de interações */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Máximo de interações</Label>
            <Badge variant="secondary" className="text-xs px-2">
              {(selectedNode.data.max_ai_interactions ?? 0) === 0
                ? "Sem limite"
                : `${selectedNode.data.max_ai_interactions} msgs`}
            </Badge>
          </div>

          <Slider
            value={[selectedNode.data.max_ai_interactions ?? 0]}
            onValueChange={(value) => updateNodeData("max_ai_interactions", value[0])}
            min={0}
            max={50}
            step={1}
            className="w-full"
          />

          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sem limite</span>
            <span>50 msgs</span>
          </div>
        </div>

        {/* Alerta: sem condição de saída */}
        {(selectedNode.data.max_ai_interactions ?? 0) === 0 &&
          (!selectedNode.data.exit_keywords || selectedNode.data.exit_keywords.length === 0) && (
          <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/30">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-yellow-700">
              Sem condição de saída configurada. A IA vai responder indefinidamente até o cliente sair do fluxo manualmente.
            </p>
          </div>
        )}
      </div>

      {/* 🆕 Seção: Validar Cliente Automaticamente */}
      <div className="space-y-3 p-3 rounded-lg border bg-green-500/5 border-green-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-500" />
            <div>
              <Label className="text-sm font-medium">Validar Cliente Automaticamente</Label>
              <p className="text-[10px] text-muted-foreground">
                Triagem silenciosa antes de responder (sem perguntar)
              </p>
            </div>
          </div>
          <Switch
            checked={selectedNode.data.auto_validate_customer ?? false}
            onCheckedChange={(checked) => updateNodeData("auto_validate_customer", checked)}
          />
        </div>

        {selectedNode.data.auto_validate_customer && (
          <div className="space-y-2 pl-6">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Dados para validação
            </Label>
            
            {[
              { id: "phone", label: "Telefone / WhatsApp" },
              { id: "email", label: "Email" },
              { id: "cpf", label: "CPF / Documento" },
            ].map((field) => {
              const validateFields: string[] = selectedNode.data.validate_fields || ["phone", "email", "cpf"];
              const isChecked = validateFields.includes(field.id);
              return (
                <div key={field.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`validate-${field.id}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const current: string[] = selectedNode.data.validate_fields || ["phone", "email", "cpf"];
                      const next = checked
                        ? [...current, field.id]
                        : current.filter((f: string) => f !== field.id);
                      updateNodeData("validate_fields", next.length > 0 ? next : ["phone"]);
                    }}
                  />
                  <Label htmlFor={`validate-${field.id}`} className="text-sm cursor-pointer">
                    {field.label}
                  </Label>
                </div>
              );
            })}
            
            <p className="text-[10px] text-muted-foreground">
              A IA verifica os dados do contato silenciosamente e atualiza <code className="bg-muted px-1 rounded">{'{{is_customer}}'}</code>
            </p>
          </div>
        )}
      </div>

      {/* Garantias */}
      <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded space-y-1">
        <p>✓ IA responde apenas ao objetivo definido</p>
        <p>✓ Respostas curtas e objetivas</p>
        <p>✓ Sem alucinações ou fugas de comportamento</p>
        <p>✓ Fallback seguro quando sem informação</p>
      </div>
    </div>
  );
}
