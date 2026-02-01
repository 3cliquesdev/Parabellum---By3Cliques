import { MessageSquare } from "lucide-react";
import { IntegrationCardBase, FieldDefinition } from "./IntegrationCardBase";

const secretFields: FieldDefinition[] = [
  {
    key: "waba_id",
    label: "WABA ID",
    placeholder: "Ex: 1234567890123456",
    type: "text",
    required: true,
    description: "ID da conta WhatsApp Business (encontrado no Meta Business Suite)",
  },
  {
    key: "phone_number_id",
    label: "Phone Number ID",
    placeholder: "Ex: 9876543210987654",
    type: "text",
    required: true,
    description: "ID do número de telefone associado à conta",
  },
  {
    key: "access_token",
    label: "Access Token",
    placeholder: "EAABw...",
    type: "password",
    required: true,
    description: "Token de acesso permanente (gerado no Meta for Developers)",
  },
];

const publicConfigFields: FieldDefinition[] = [
  {
    key: "display_name",
    label: "Nome de exibição",
    placeholder: "Ex: Suporte WhatsApp",
    type: "text",
    description: "Nome para identificar esta integração internamente",
  },
];

interface WhatsAppMetaIntegrationCardProps {
  workspaceId?: string;
}

export function WhatsAppMetaIntegrationCard({ workspaceId }: WhatsAppMetaIntegrationCardProps) {
  return (
    <IntegrationCardBase
      provider="whatsapp_meta"
      title="WhatsApp Meta Cloud API"
      description="Configure suas credenciais do WhatsApp Business"
      icon={MessageSquare}
      iconColor="text-green-600"
      fields={secretFields}
      publicConfigFields={publicConfigFields}
      workspaceId={workspaceId}
    />
  );
}
