import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface VerifyCustomerOTPPropertiesPanelProps {
  selectedNode: Node;
  updateNodeData: (field: string, value: any) => void;
}

export function VerifyCustomerOTPPropertiesPanel({ selectedNode, updateNodeData }: VerifyCustomerOTPPropertiesPanelProps) {
  return (
    <div className="space-y-4">
      {/* Mensagens configuráveis */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold">Mensagens do fluxo OTP</Label>

        <div className="space-y-1">
          <Label className="text-[10px]">📧 Pedir email</Label>
          <Textarea
            value={selectedNode.data.message_ask_email || "Para verificar sua identidade, me informe seu email cadastrado:"}
            onChange={(e) => updateNodeData("message_ask_email", e.target.value)}
            className="min-h-[50px] text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px]">✅ OTP enviado</Label>
          <Textarea
            value={selectedNode.data.message_otp_sent || "Enviamos um código de 6 dígitos para {{email}}. Digite o código:"}
            onChange={(e) => updateNodeData("message_otp_sent", e.target.value)}
            className="min-h-[50px] text-sm"
          />
          <p className="text-[9px] text-muted-foreground">Use {"{{email}}"} para inserir o email</p>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px]">❌ Email não encontrado</Label>
          <Textarea
            value={selectedNode.data.message_not_found || "Não encontramos este email em nossa base. O email está correto?"}
            onChange={(e) => updateNodeData("message_not_found", e.target.value)}
            className="min-h-[50px] text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px]">🚫 Não é cliente</Label>
          <Textarea
            value={selectedNode.data.message_not_customer || "Vou encaminhar para nosso time comercial."}
            onChange={(e) => updateNodeData("message_not_customer", e.target.value)}
            className="min-h-[50px] text-sm"
          />
        </div>
      </div>

      {/* Configurações */}
      <div className="pt-2 border-t space-y-2">
        <Label className="text-xs font-semibold">Configurações</Label>

        <div className="space-y-1">
          <Label className="text-[10px]">Máximo de tentativas OTP</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={selectedNode.data.max_attempts || 3}
            onChange={(e) => updateNodeData("max_attempts", parseInt(e.target.value) || 3)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Variáveis de saída */}
      <div className="pt-2 border-t">
        <Label className="text-xs text-muted-foreground">Variável de saída</Label>
        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Cliente verificado?</Label>
            <Input
              value={selectedNode.data.save_verified_as || "customer_verified"}
              onChange={(e) => updateNodeData("save_verified_as", e.target.value)}
              placeholder="customer_verified"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Preview de variáveis */}
      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">Variáveis disponíveis após execução:</p>
        <div className="space-y-0.5 font-mono text-[10px]">
          <p><span className="text-green-600">{`{{${selectedNode.data.save_verified_as || "customer_verified"}}}`}</span> → true/false</p>
          <p><span className="text-blue-600">{`{{customer_verified_email}}`}</span> → Email verificado</p>
          <p><span className="text-purple-600">{`{{customer_verified_name}}`}</span> → Nome do cliente</p>
          <p><span className="text-amber-600">{`{{__otp_result}}`}</span> → verified / not_customer / failed</p>
        </div>
      </div>

      {/* Fluxo visual */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-[10px] font-medium text-muted-foreground mb-2">Fluxo interno:</p>
        <div className="space-y-1 text-[9px]">
          <p>1️⃣ Pede email ao usuário</p>
          <p>2️⃣ Verifica na base de clientes</p>
          <p>3️⃣ Se encontrado → envia OTP por email</p>
          <p>4️⃣ Usuário digita código → valida</p>
          <p>5️⃣ Resultado salvo em variáveis</p>
        </div>
      </div>
    </div>
  );
}
