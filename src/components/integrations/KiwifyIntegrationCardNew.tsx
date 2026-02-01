import { ShoppingCart } from "lucide-react";
import { IntegrationCardBase, FieldDefinition } from "./IntegrationCardBase";

const secretFields: FieldDefinition[] = [
  {
    key: "client_id",
    label: "Client ID",
    placeholder: "Seu Client ID da Kiwify",
    type: "text",
    required: true,
    description: "ID do cliente OAuth (obtido no painel de integrações Kiwify)",
  },
  {
    key: "client_secret",
    label: "Client Secret",
    placeholder: "Seu Client Secret",
    type: "password",
    required: true,
    description: "Segredo do cliente OAuth",
  },
  {
    key: "account_id",
    label: "Account ID",
    placeholder: "ID da sua conta Kiwify",
    type: "text",
    required: false,
    description: "ID da conta (opcional, usado para validações adicionais)",
  },
];

const publicConfigFields: FieldDefinition[] = [
  {
    key: "store_name",
    label: "Nome da loja",
    placeholder: "Minha Loja",
    type: "text",
    description: "Nome para identificar esta integração",
  },
];

interface KiwifyIntegrationCardNewProps {
  workspaceId?: string;
}

export function KiwifyIntegrationCardNew({ workspaceId }: KiwifyIntegrationCardNewProps) {
  return (
    <IntegrationCardBase
      provider="kiwify"
      title="Kiwify"
      description="Integração com e-commerce e pagamentos"
      icon={ShoppingCart}
      iconColor="text-orange-600"
      fields={secretFields}
      publicConfigFields={publicConfigFields}
      workspaceId={workspaceId}
    />
  );
}
