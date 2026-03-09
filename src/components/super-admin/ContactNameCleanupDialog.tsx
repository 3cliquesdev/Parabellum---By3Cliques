import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, CheckCircle2, AlertTriangle } from "lucide-react";

interface CleanupContact {
  id: string;
  first_name: string;
  last_name: string;
  suggested_first: string;
  suggested_last: string;
  selected: boolean;
}

const PRODUCT_PATTERNS = /(\d+\s*(un|pç|peças|peça|pçs|ml|l|kg|g|cm|mm|m)\b|jogo\s+de|kit\s+de|conjunto|panela|frigideira|caçarola|tampa|assadeira|fervedor|leiteira)/i;

function cleanName(raw: string): string {
  // Take text before first " - "
  let cleaned = raw.split(" - ")[0].trim();
  // If still long or has product patterns, try splitting by other separators
  if (cleaned.length > 40 || PRODUCT_PATTERNS.test(cleaned)) {
    cleaned = cleaned.split(/[|\/\\]/)[0].trim();
  }
  // Capitalize first letter of each word
  cleaned = cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return cleaned || raw;
}

function isSuspicious(firstName: string, lastName: string): boolean {
  const full = `${firstName} ${lastName}`;
  if (full.includes(" - ") && full.length > 30) return true;
  if (firstName.length > 40 || lastName.length > 40) return true;
  if (PRODUCT_PATTERNS.test(firstName) || PRODUCT_PATTERNS.test(lastName)) return true;
  return false;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactNameCleanupDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"idle" | "scanning" | "preview" | "applying" | "done">("idle");
  const [contacts, setContacts] = useState<CleanupContact[]>([]);
  const [appliedCount, setAppliedCount] = useState(0);

  const handleScan = async () => {
    setStep("scanning");
    try {
      // Fetch all contacts (paginate if needed)
      let allContacts: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .range(from, from + batchSize - 1);

        if (error) throw error;
        if (data) allContacts = [...allContacts, ...data];
        hasMore = (data?.length || 0) === batchSize;
        from += batchSize;
      }

      const suspicious = allContacts
        .filter((c) => isSuspicious(c.first_name, c.last_name))
        .map((c) => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          suggested_first: cleanName(c.first_name),
          suggested_last: cleanName(c.last_name),
          selected: true,
        }));

      setContacts(suspicious);
      setStep("preview");

      if (suspicious.length === 0) {
        toast({ title: "Nenhum contato suspeito encontrado", description: "Todos os nomes parecem corretos." });
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast({ title: "Erro ao escanear", description: "Não foi possível buscar contatos.", variant: "destructive" });
      setStep("idle");
    }
  };

  const handleApply = async () => {
    const selected = contacts.filter((c) => c.selected);
    if (selected.length === 0) return;

    setStep("applying");
    let count = 0;

    try {
      for (const c of selected) {
        const { error } = await supabase
          .from("contacts")
          .update({ first_name: c.suggested_first, last_name: c.suggested_last })
          .eq("id", c.id);

        if (!error) count++;
      }

      setAppliedCount(count);
      setStep("done");
      toast({ title: "Limpeza concluída", description: `${count} contato(s) corrigido(s) com sucesso.` });
    } catch (err) {
      console.error("Apply error:", err);
      toast({ title: "Erro ao aplicar", description: "Ocorreu um erro durante a limpeza.", variant: "destructive" });
      setStep("preview");
    }
  };

  const toggleSelect = (id: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
  };

  const toggleAll = (checked: boolean) => {
    setContacts((prev) => prev.map((c) => ({ ...c, selected: checked })));
  };

  const updateSuggested = (id: string, field: "suggested_first" | "suggested_last", value: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep("idle");
      setContacts([]);
      setAppliedCount(0);
    }
    onOpenChange(open);
  };

  const selectedCount = contacts.filter((c) => c.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Limpeza de Nomes de Contatos
          </DialogTitle>
          <DialogDescription>
            Detecta e corrige nomes com texto de produto concatenado na importação.
          </DialogDescription>
        </DialogHeader>

        {/* Step: Idle */}
        {step === "idle" && (
          <div className="py-8 text-center space-y-4">
            <p className="text-muted-foreground">
              Clique para escanear contatos com nomes suspeitos (ex: "Maria - Jogo de 5 Panelas...").
            </p>
            <Button onClick={handleScan} size="lg">
              <Search className="h-4 w-4 mr-2" />
              Escanear Contatos
            </Button>
          </div>
        )}

        {/* Step: Scanning */}
        {step === "scanning" && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Escaneando contatos...</p>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && contacts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                {contacts.length} contato(s) encontrado(s) · {selectedCount} selecionado(s)
              </Badge>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedCount === contacts.length}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                />
                <span className="text-sm text-muted-foreground">Selecionar todos</span>
              </div>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Nome Atual</TableHead>
                    <TableHead>Nome Corrigido</TableHead>
                    <TableHead>Sobrenome Corrigido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Checkbox
                          checked={c.selected}
                          onCheckedChange={() => toggleSelect(c.id)}
                        />
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-xs text-destructive line-through truncate" title={`${c.first_name} ${c.last_name}`}>
                          {c.first_name} {c.last_name}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={c.suggested_first}
                          onChange={(e) => updateSuggested(c.id, "suggested_first", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={c.suggested_last}
                          onChange={(e) => updateSuggested(c.id, "suggested_last", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "preview" && contacts.length === 0 && (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum contato com nome suspeito encontrado!</p>
          </div>
        )}

        {/* Step: Applying */}
        {step === "applying" && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Aplicando correções...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <p className="text-lg font-medium">{appliedCount} contato(s) corrigido(s)</p>
            <p className="text-muted-foreground">Os nomes foram atualizados com sucesso.</p>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && contacts.length > 0 && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleApply} disabled={selectedCount === 0}>
                Aplicar {selectedCount} correção(ões)
              </Button>
            </>
          )}
          {(step === "done" || (step === "preview" && contacts.length === 0)) && (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
