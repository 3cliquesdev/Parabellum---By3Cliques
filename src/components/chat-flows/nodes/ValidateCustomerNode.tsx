import { memo } from "react";
import { NodeProps } from "reactflow";
import { ShieldCheck } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";

interface ValidateCustomerNodeData {
  label: string;
  validate_phone: boolean;
  validate_email: boolean;
  validate_cpf: boolean;
  save_validated_as: string;
  save_customer_name_as: string;
  save_customer_email_as: string;
}

export const ValidateCustomerNode = memo(({ data, selected }: NodeProps<ValidateCustomerNodeData>) => {
  const fields: string[] = [];
  if (data.validate_phone !== false) fields.push("Tel");
  if (data.validate_email !== false) fields.push("Email");
  if (data.validate_cpf === true) fields.push("CPF");

  return (
    <ChatFlowNodeWrapper
      type="validate_customer"
      icon={ShieldCheck}
      title={data.label || "Validar Cliente"}
      subtitle={fields.length > 0 ? `Validar por: ${fields.join(", ")}` : "Nenhum campo selecionado"}
      selected={selected}
    >
      <div className="flex flex-wrap gap-1">
        {fields.map((f) => (
          <span
            key={f}
            className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium"
          >
            {f}
          </span>
        ))}
      </div>
    </ChatFlowNodeWrapper>
  );
});

ValidateCustomerNode.displayName = "ValidateCustomerNode";
