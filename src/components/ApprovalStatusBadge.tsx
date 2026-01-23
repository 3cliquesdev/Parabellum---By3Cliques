import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ApprovalStatusBadgeProps {
  status: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  approverName?: string | null;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
}

type ApprovalState = "pending" | "approved" | "rejected" | null;

export function ApprovalStatusBadge({
  status,
  approvedBy,
  approvedAt,
  rejectionReason,
  approverName,
  showDetails = false,
  size = "md",
}: ApprovalStatusBadgeProps) {
  const getApprovalState = (): ApprovalState => {
    if (status === "pending_approval") return "pending";
    if (approvedBy && (status === "resolved" || status === "closed")) return "approved";
    if (rejectionReason && status === "in_progress") return "rejected";
    return null;
  };

  const approvalState = getApprovalState();

  if (!approvalState) return null;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const config = {
    pending: {
      icon: Clock,
      label: "Aguard. Aprovação",
      className: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
      iconClass: "text-yellow-600",
    },
    approved: {
      icon: CheckCircle2,
      label: "Aprovado",
      className: "bg-green-500/20 text-green-700 border-green-500/30",
      iconClass: "text-green-600",
    },
    rejected: {
      icon: XCircle,
      label: "Rejeitado",
      className: "bg-red-500/20 text-red-700 border-red-500/30",
      iconClass: "text-red-600",
    },
  };

  const { icon: Icon, label, className, iconClass } = config[approvalState];

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className={`${className} ${sizeClasses[size]} flex items-center gap-1.5 w-fit`}>
        <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
        {label}
      </Badge>

      {showDetails && (
        <div className="text-xs text-muted-foreground pl-1">
          {approvalState === "approved" && approvedAt && (
            <span>
              {approverName ? `Por ${approverName}` : "Aprovado"}{" "}
              {formatDistanceToNow(new Date(approvedAt), { addSuffix: true, locale: ptBR })}
            </span>
          )}
          {approvalState === "rejected" && rejectionReason && (
            <div className="flex items-start gap-1 mt-1">
              <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-red-600">{rejectionReason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
