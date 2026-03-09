import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrganizationContacts, useSearchContactsForOrg } from "@/hooks/useOrganizationContacts";
import { Mail, Phone, UserMinus, UserPlus, Search, Users, Building2 } from "lucide-react";
import OrganizationPhonesSection from "@/components/OrganizationPhonesSection";

interface Props {
  orgId: string;
  orgName: string;
  trigger: React.ReactNode;
}

export default function OrganizationContactsDialog({ orgId, orgName, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ id: string; name: string; fromOrg: string } | null>(null);
  const { contacts, addContact, removeContact } = useOrganizationContacts(open ? orgId : null);
  const searchResults = useSearchContactsForOrg(open ? orgId : null, search);

  const handleAdd = (c: any) => {
    const contactName = `${c.first_name} ${c.last_name}`.trim();
    if (c.organization_id) {
      const orgName = (c.organizations as any)?.name || "outra organização";
      setMoveTarget({ id: c.id, name: contactName, fromOrg: orgName });
    } else {
      addContact.mutate(c.id);
      setSearch("");
    }
  };

  const confirmMove = () => {
    if (moveTarget) {
      addContact.mutate(moveTarget.id);
      setSearch("");
      setMoveTarget(null);
    }
  };

  const confirmRemove = () => {
    if (removeTarget) {
      removeContact.mutate(removeTarget.id);
      setRemoveTarget(null);
    }
  };

  return (
    <>
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
                        onClick={() => setRemoveTarget({ id: c.id, name: `${c.first_name} ${c.last_name}` })}
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
                placeholder="Digite ao menos 2 caracteres para buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {search.length >= 2 && (
              <ScrollArea className="max-h-40">
                {searchResults.isLoading ? (
                  <p className="text-sm text-muted-foreground p-2">Buscando...</p>
                ) : !searchResults.data?.length ? (
                  <p className="text-sm text-muted-foreground p-2">Nenhum contato encontrado</p>
                ) : (
                  <div className="space-y-1">
                    {searchResults.data.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{c.phone || c.email || "—"}</span>
                            {c.organization_id && (
                              <span className="flex items-center gap-1 text-warning">
                                <Building2 className="h-3 w-3" />
                                {(c.organizations as any)?.name || "Outra org"}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAdd(c)}
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

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo</AlertDialogTitle>
            <AlertDialogDescription>
              Remover o vínculo de <strong>{removeTarget?.name}</strong> com esta organização?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move confirmation */}
      <AlertDialog open={!!moveTarget} onOpenChange={(v) => !v && setMoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover contato</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{moveTarget?.name}</strong> está vinculado a <strong>{moveTarget?.fromOrg}</strong>. Deseja movê-lo para <strong>{orgName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMove}>Mover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
