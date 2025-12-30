import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";

interface UpdateSecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  secretName: string;
  description: string;
  isConfigured: boolean;
}

export default function UpdateSecretModal({
  isOpen,
  onClose,
  secretName,
  description,
  isConfigured,
}: UpdateSecretModalProps) {
  const [showValue, setShowValue] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isConfigured ? "Atualizar" : "Configurar"} Secret
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="secretName">Nome do Secret</Label>
            <Input
              id="secretName"
              value={secretName}
              disabled
              className="font-mono bg-muted"
            />
          </div>

          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  Atualização Segura via Lovable Cloud
                </p>
                <p className="text-muted-foreground">
                  Por segurança, secrets são gerenciados pelo Lovable Cloud. 
                  Para atualizar este secret, solicite ao suporte ou use a 
                  ferramenta de secrets no painel do Lovable.
                </p>
                <p className="text-muted-foreground">
                  <strong>Caminho:</strong> Lovable Editor → Ferramentas → Secrets → {secretName}
                </p>
              </div>
            </div>
          </div>

          {isConfigured && (
            <div className="space-y-2">
              <Label>Valor Atual</Label>
              <div className="flex gap-2">
                <Input
                  type={showValue ? "text" : "password"}
                  value="••••••••••••••••••••"
                  disabled
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowValue(!showValue)}
                  disabled
                >
                  {showValue ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Por segurança, o valor real não é exibido
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
