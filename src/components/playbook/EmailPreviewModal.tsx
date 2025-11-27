import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail } from "lucide-react";

interface EmailPreviewModalProps {
  open: boolean;
  onClose: () => void;
  htmlContent: string;
  subject: string;
  recipientEmail: string;
}

export function EmailPreviewModal({
  open,
  onClose,
  htmlContent,
  subject,
  recipientEmail,
}: EmailPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            📧 Preview do Email
          </DialogTitle>
        </DialogHeader>

        {/* Email Headers */}
        <div className="bg-muted p-4 rounded-lg text-sm space-y-2 border">
          <div className="flex gap-2">
            <span className="font-semibold min-w-[60px]">Para:</span>
            <span className="text-muted-foreground">{recipientEmail}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold min-w-[60px]">Assunto:</span>
            <span>{subject}</span>
          </div>
        </div>

        {/* Email Body in Iframe */}
        <div className="flex-1 border rounded-lg overflow-hidden bg-white">
          <iframe
            srcDoc={htmlContent}
            className="w-full h-[500px]"
            sandbox="allow-same-origin"
            title="Email Preview"
          />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Este é apenas um preview. Em produção, o e-mail seria enviado via Resend.
        </p>
      </DialogContent>
    </Dialog>
  );
}
