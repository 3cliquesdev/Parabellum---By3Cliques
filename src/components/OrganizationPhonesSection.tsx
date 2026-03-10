import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrganizationPhones } from "@/hooks/useOrganizationPhones";
import { Phone, Plus, Trash2 } from "lucide-react";

interface Props {
  orgId: string;
}

export default function OrganizationPhonesSection({ orgId }: Props) {
  const { phones, addPhone, removePhone } = useOrganizationPhones(orgId);
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");

  const handleAdd = () => {
    if (!label.trim() || !phone.trim()) return;
    addPhone.mutate({ label: label.trim(), phone: phone.trim() }, {
      onSuccess: () => { setLabel(""); setPhone(""); },
    });
  };

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Phone className="h-4 w-4" />
        Telefones WhatsApp ({phones.data?.length || 0})
      </p>

      <ScrollArea className="max-h-36">
        {phones.isLoading ? (
          <p className="text-sm text-muted-foreground p-2">Carregando...</p>
        ) : !phones.data?.length ? (
          <p className="text-sm text-muted-foreground p-2">Nenhum telefone cadastrado</p>
        ) : (
          <div className="space-y-1">
            {phones.data.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.phone}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePhone.mutate(p.id)}
                  disabled={removePhone.isPending}
                  className="text-destructive hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          placeholder="Nome / Rótulo"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="WhatsApp"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-36"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={addPhone.isPending || !label.trim() || !phone.trim()}
          className="flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
