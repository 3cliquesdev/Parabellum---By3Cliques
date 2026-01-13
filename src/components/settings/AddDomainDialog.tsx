import { useState } from "react";
import { Globe, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DnsRecordsTable } from "./DnsRecordsTable";

interface AddDomainDialogProps {
  onDomainAdded: () => void;
}

export function AddDomainDialog({ onDomainAdded }: AddDomainDialogProps) {
  const [open, setOpen] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [createdDomain, setCreatedDomain] = useState<any>(null);
  const { toast } = useToast();

  const validateDomain = (domain: string): boolean => {
    // Basic domain validation
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  };

  const handleCreateDomain = async () => {
    if (!domainName.trim()) {
      toast({
        title: "Domínio obrigatório",
        description: "Digite um nome de domínio válido",
        variant: "destructive",
      });
      return;
    }

    if (!validateDomain(domainName)) {
      toast({
        title: "Formato inválido",
        description: "Digite um domínio válido (ex: mail.seusite.com)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("resend-domain-manager", {
        body: { action: "create", domainName },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setCreatedDomain(data.domain);
      toast({
        title: "Domínio criado!",
        description: "Configure os registros DNS abaixo para verificar",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar domínio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setDomainName("");
    setCreatedDomain(null);
    if (createdDomain) {
      onDomainAdded();
    }
  };

  // Transform DNS records from Resend format to our table format
  const transformRecords = (domain: any) => {
    if (!domain?.records) return [];
    return domain.records.map((r: any) => ({
      record: r.record,
      name: r.name,
      type: r.type,
      ttl: r.ttl || "Auto",
      status: r.status,
      value: r.value,
      priority: r.priority,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Domínio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Adicionar Novo Domínio
          </DialogTitle>
          <DialogDescription>
            Adicione um domínio para enviar emails personalizados
          </DialogDescription>
        </DialogHeader>

        {!createdDomain ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Nome do Domínio</Label>
              <Input
                id="domain"
                placeholder="mail.seusite.com"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value.toLowerCase())}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Recomendamos usar um subdomínio como <code>mail.seusite.com</code> ou <code>send.seusite.com</code>
              </p>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Importante:</strong> Após criar o domínio, você precisará configurar os 
                registros DNS no painel do seu provedor de domínio (GoDaddy, Cloudflare, etc).
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200">
              <AlertDescription className="text-green-700 dark:text-green-400">
                ✅ Domínio <strong>{createdDomain.name}</strong> criado com sucesso!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Configure os registros DNS abaixo:
              </Label>
              <p className="text-sm text-muted-foreground">
                Acesse o painel do seu provedor de domínio e adicione estes registros:
              </p>
            </div>

            <DnsRecordsTable records={transformRecords(createdDomain)} />

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Próximos passos:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Configure todos os registros DNS acima no seu provedor</li>
                  <li>Aguarde a propagação DNS (pode levar até 48h)</li>
                  <li>Clique em "Verificar" no domínio para confirmar</li>
                </ol>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {!createdDomain ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateDomain} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Domínio"
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Fechar e Atualizar Lista
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
