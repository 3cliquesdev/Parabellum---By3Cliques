import { memo } from "react";
import { NodeProps } from "reactflow";
import { ShieldCheck } from "lucide-react";
import { ChatFlowNodeWrapper } from "../ChatFlowNodeWrapper";

interface VerifyCustomerOTPNodeData {
  label: string;
  message_ask_email: string;
  message_otp_sent: string;
  message_not_found: string;
  message_not_customer: string;
  save_verified_as: string;
  max_attempts: number;
}

export const VerifyCustomerOTPNode = memo(({ data, selected }: NodeProps<VerifyCustomerOTPNodeData>) => {
  const steps = ["Email", "Verificar", "OTP"];

  return (
    <ChatFlowNodeWrapper
      type="verify_customer_otp"
      icon={ShieldCheck}
      title={data.label || "Verificar Cliente + OTP"}
      subtitle="Verifica email na base e envia código OTP"
      selected={selected}
    >
      <div className="flex flex-wrap gap-1">
        {steps.map((s) => (
          <span
            key={s}
            className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-medium"
          >
            {s}
          </span>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground mt-1">
        Max tentativas: {data.max_attempts || 3}
      </p>
    </ChatFlowNodeWrapper>
  );
});

VerifyCustomerOTPNode.displayName = "VerifyCustomerOTPNode";
