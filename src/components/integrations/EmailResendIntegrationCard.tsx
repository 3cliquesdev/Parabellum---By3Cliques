import { Mail } from "lucide-react";
import { IntegrationCardBase, FieldDefinition } from "./IntegrationCardBase";

const secretFields: FieldDefinition[] = [
  {
    key: "api_key",
    label: "API Key",
    placeholder: "re_...",
    type: "password",
    required: true,
    description: "Chave de API do Resend (encontrada em resend.com/api-keys)",
  },
];

const publicConfigFields: FieldDefinition[] = [
  {
    key: "default_from",
    label: "E-mail remetente padrão",
    placeholder: "noreply@seudominio.com",
    type: "text",
    description: "E-mail usado como remetente padrão (deve ser de domínio verificado)",
  },
  {
    key: "default_from_name",
    label: "Nome do remetente",
    placeholder: "Equipe de Suporte",
    type: "text",
    description: "Nome exibido junto ao e-mail remetente",
  },
];

interface EmailResendIntegrationCardProps {
  workspaceId?: string;
}

export function EmailResendIntegrationCard({ workspaceId }: EmailResendIntegrationCardProps) {
  return (
    <IntegrationCardBase
      provider="email_resend"
      title="E-mail (Resend)"
      description="Configure o envio de e-mails transacionais"
      icon={Mail}
      iconColor="text-blue-600"
      fields={secretFields}
      publicConfigFields={publicConfigFields}
      workspaceId={workspaceId}
    />
  );
}
