import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrganizationContacts, useSearchContactsForOrg } from "@/hooks/useOrganizationContacts";
import { Mail, Phone, UserMinus, UserPlus, Search, Users } from "lucide-react";

interface Props {
  orgId: string;
  orgName: string;
  trigger: React.ReactNode;
}

export default function OrganizationContactsDialog({ orgId, orgName, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { contacts, addContact, removeContact } = useOrganizationContacts(open ? orgId : null);
  const searchResults = useSearchContactsForOrg(open ? orgId : null, search);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contatos — {orgName}
          </DialogTitle>
        </DialogHeader>

        {/* Linked contacts */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Vinculados ({contacts.data?.length || 0})
          </p>
          <ScrollArea className="max-h-48">
            {contacts.isLoading ? (
              <p className="text-sm text-muted-foreground p-2">Carregando...</p>
            ) : !contacts.data?.length ? (
              <p className="text-sm text-muted-foreground p-2">Nenhum contato vinculado</p>
            ) : (
              <div className="space-y-1">
                {contacts.data.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" /> {c.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeContact.mutate(c.id)}
                      disabled={removeContact.isPending}
                      className="text-destructive hover:text-destructive flex-shrink-0"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Add contact */}
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium text-muted-foreground">Adicionar contato</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {search.length >= 1 && (
            <ScrollArea className="max-h-40">
              {searchResults.isLoading ? (
                <p className="text-sm text-muted-foreground p-2">Buscando...</p>
              ) : !searchResults.data?.length ? (
                <p className="text-sm text-muted-foreground p-2">Nenhum contato encontrado</p>
              ) : (
                <div className="space-y-1">
                  {searchResults.data.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                        <span className="text-xs text-muted-foreground">{c.phone || c.email || "—"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { addContact.mutate(c.id); setSearch(""); }}
                        disabled={addContact.isPending}
                        className="text-primary flex-shrink-0"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
