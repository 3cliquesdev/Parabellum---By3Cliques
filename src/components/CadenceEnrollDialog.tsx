import { useState } from "react";
import { useContacts } from "@/hooks/useContacts";
import { useEnrollContact } from "@/hooks/useEnrollContact";
import { useCadenceEnrollments } from "@/hooks/useCadenceEnrollments";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface CadenceEnrollDialogProps {
  cadence: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CadenceEnrollDialog({ cadence, open, onOpenChange }: CadenceEnrollDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const { data: contacts, isLoading: loadingContacts } = useContacts();
  const { data: enrollments } = useCadenceEnrollments({ cadenceId: cadence?.id });
  const enrollMutation = useEnrollContact();

  // IDs de contatos já inscritos nesta cadência
  const enrolledContactIds = new Set(enrollments?.map(e => e.contact_id) || []);

  // Filtrar contatos disponíveis (não inscritos e buscando por nome/email)
  const availableContacts = contacts?.filter(c => {
    if (enrolledContactIds.has(c.id)) return false;
    
    const searchLower = search.toLowerCase();
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const email = (c.email || "").toLowerCase();
    
    return fullName.includes(searchLower) || email.includes(searchLower);
  }) || [];

  const handleToggleContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === availableContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(availableContacts.map(c => c.id));
    }
  };

  const handleEnroll = async () => {
    if (!cadence || selectedContacts.length === 0) return;

    setIsEnrolling(true);
    let successCount = 0;
    let errorCount = 0;

    for (const contactId of selectedContacts) {
      try {
        await enrollMutation.mutateAsync({
          contact_id: contactId,
          cadence_id: cadence.id,
          start_immediately: true,
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Failed to enroll contact ${contactId}:`, error);
      }
    }

    setIsEnrolling(false);
    setSelectedContacts([]);
    
    if (successCount > 0) {
      toast.success(`${successCount} contato(s) inscrito(s) com sucesso!`);
    }
    if (errorCount > 0) {
      toast.error(`Falha ao inscrever ${errorCount} contato(s)`);
    }

    if (errorCount === 0) {
      onOpenChange(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Inscrever Contatos
          </DialogTitle>
          <DialogDescription>
            Selecione os contatos para inscrever na cadência "{cadence?.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {availableContacts.length} contato(s) disponível(is)
            </span>
            {availableContacts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedContacts.length === availableContacts.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            )}
          </div>

          {/* Contacts List */}
          <ScrollArea className="h-[300px] border rounded-md">
            {loadingContacts ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Users className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search ? "Nenhum contato encontrado" : "Todos os contatos já estão inscritos"}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {availableContacts.map(contact => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleContact(contact.id)}
                  >
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => handleToggleContact(contact.id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(contact.first_name, contact.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.email || contact.phone || "Sem contato"}
                      </p>
                    </div>
                    {contact.status && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {contact.status}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected count */}
          {selectedContacts.length > 0 && (
            <div className="text-sm text-center text-muted-foreground">
              {selectedContacts.length} contato(s) selecionado(s)
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleEnroll} 
            disabled={selectedContacts.length === 0 || isEnrolling}
          >
            {isEnrolling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Inscrevendo...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Inscrever ({selectedContacts.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
