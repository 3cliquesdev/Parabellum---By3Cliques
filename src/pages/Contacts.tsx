import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Mail, Phone, Trash2, Eye, UserCog, ArrowUpDown } from "lucide-react";
import { useContacts, useDeleteContact, ContactFilters } from "@/hooks/useContacts";
import { useTags } from "@/hooks/useTags";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import ContactDialog from "@/components/ContactDialog";
import ContactSheet from "@/components/ContactSheet";
import { ContactCard } from "@/components/contacts/ContactCard";
import { PageContainer, PageHeader, PageContent, PageFilters } from "@/components/ui/page-container";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import ContactFilterPopover from "@/components/contacts/ContactFilterPopover";
import { ActiveFilterChips, generateContactFilterChips } from "@/components/ui/active-filter-chips";
import { ContactsBulkActions } from "@/components/contacts/ContactsBulkActions";
import { ChangeConsultantDialog } from "@/components/playbooks/ChangeConsultantDialog";
import { ConsultantClientsSheet } from "@/components/contacts/ConsultantClientsSheet";
import { useUserRole } from "@/hooks/useUserRole";
import { useConsultants } from "@/hooks/useConsultants";
import { LeadScoreBadge } from "@/components/scoring/LeadScoreBadge";
import type { Tables } from "@/integrations/supabase/types";

type ContactWithOrg = Tables<"contacts"> & {
  organizations: { name: string } | null;
};

export default function Contacts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobileBreakpoint();
  const filter = searchParams.get("filter") || "all";
  const [selectedContact, setSelectedContact] = useState<ContactWithOrg | null>(null);
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [consultantDialogContact, setConsultantDialogContact] = useState<ContactWithOrg | null>(null);
  const [consultantSheet, setConsultantSheet] = useState<{ id: string; name: string } | null>(null);
  
  const { isAdmin, isManager, isCSManager } = useUserRole();
  const canChangeConsultant = isAdmin || isManager || isCSManager;
  const { data: consultants } = useConsultants(true);
  
  // Advanced filters state
  const [contactFilters, setContactFilters] = useState<ContactFilters & { search: string; tags: string[] }>({
    search: "",
    tags: [],
    customerType: "all",
    blocked: "all",
    subscriptionPlan: "all",
  });

  // Debounce search to avoid query on every keystroke
  const debouncedSearch = useDebouncedValue(contactFilters.search, 300);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredContacts.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const { data: tags } = useTags("customer");
  const { data: contacts, isLoading } = useContacts({
    searchQuery: debouncedSearch,
    customerType: contactFilters.customerType,
    blocked: contactFilters.blocked,
    subscriptionPlan: contactFilters.subscriptionPlan,
    status: contactFilters.status,
    lastContactFilter: contactFilters.lastContactFilter,
    ltvMin: contactFilters.ltvMin,
    ltvMax: contactFilters.ltvMax,
    tags: contactFilters.tags,
    state: contactFilters.state,
  });
  const deleteContact = useDeleteContact();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("filter", value);
    navigate(`/contacts?${params.toString()}`);
  };

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    
    switch (filter) {
      case "active":
        return contacts.filter(c => c.email || c.phone);
      case "inactive":
        return contacts.filter(c => !c.email && !c.phone);
      default:
        return contacts;
    }
  }, [contacts, filter]);

  // Generate filter chips
  const filterChips = useMemo(() => 
    generateContactFilterChips(contactFilters, tags || []),
    [contactFilters, tags]
  );

  const handleRemoveFilterChip = (key: string) => {
    if (key.startsWith("tag_")) {
      const tagId = key.replace("tag_", "");
      setContactFilters({
        ...contactFilters,
        tags: contactFilters.tags.filter(t => t !== tagId),
      });
    } else if (key === "ltv" || key === "ltvMin") {
      setContactFilters({ ...contactFilters, ltvMin: undefined });
    } else if (key === "ltvMax") {
      setContactFilters({ ...contactFilters, ltvMax: undefined });
    } else {
      setContactFilters({ ...contactFilters, [key]: undefined });
    }
  };

  const clearAllFilters = () => {
    setContactFilters({
      search: "",
      tags: [],
      customerType: "all",
      blocked: "all",
      subscriptionPlan: "all",
    });
  };

  const handleContactClick = (contact: ContactWithOrg) => {
    if (isMobile) {
      navigate(`/contacts/${contact.id}`);
    } else {
      setSelectedContact(contact);
      setShowContactSheet(true);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Contatos" description="Gerencie seus contatos e relacionamentos">
        <ContactDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {!isMobile && "Adicionar Contato"}
            </Button>
          }
        />
      </PageHeader>

      <PageFilters>
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="inactive">Inativos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            value={contactFilters.search}
            onChange={(e) => setContactFilters({ ...contactFilters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        <ContactFilterPopover
          filters={contactFilters}
          onFiltersChange={setContactFilters}
        />
      </PageFilters>

      {filterChips.length > 0 && (
        <div className="px-4 md:px-6 pb-4">
          <ActiveFilterChips
            chips={filterChips}
            onRemoveChip={handleRemoveFilterChip}
            onClearAll={clearAllFilters}
          />
        </div>
      )}

      <PageContent>
        {!filteredContacts || filteredContacts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              {contactFilters.search ? "Nenhum contato encontrado" : "Nenhum contato cadastrado ainda"}
            </p>
          </div>
        ) : isMobile ? (
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {filteredContacts.map((contact: ContactWithOrg) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={() => handleContactClick(contact)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.length === filteredContacts.length && filteredContacts.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[150px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact: ContactWithOrg) => (
                  <TableRow 
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleContactClick(contact)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(contact.id)}
                        onCheckedChange={(checked) => handleSelectOne(contact.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {contact.first_name[0]}{contact.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {contact.first_name} {contact.last_name}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {contact.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {contact.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <LeadScoreBadge
                        score={contact.lead_score}
                        classification={contact.lead_classification}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const consultant = profiles?.find(p => p.id === contact.consultant_id);
                        return consultant ? (
                          <div className="flex items-center gap-2">
                            {canChangeConsultant ? (
                              <button
                                className="text-sm text-primary hover:underline cursor-pointer font-medium"
                                onClick={() => setConsultantSheet({ id: consultant.id, name: consultant.full_name || "" })}
                              >
                                {consultant.full_name}
                              </button>
                            ) : (
                              <span className="text-sm">{consultant.full_name}</span>
                            )}
                            {canChangeConsultant && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setConsultantDialogContact(contact)}
                              >
                                <UserCog className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">Não atribuído</span>
                            {canChangeConsultant && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setConsultantDialogContact(contact)}
                              >
                                <UserCog className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {contact.customer_type ? (
                        <Badge variant="outline">{contact.customer_type}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.subscription_plan ? (
                        <Badge variant="secondary">{contact.subscription_plan}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.blocked ? (
                        <Badge variant="destructive">Bloqueado</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/contacts/${contact.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir {contact.first_name} {contact.last_name}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteContact.mutate(contact.id);
                                }}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageContent>

      {!isMobile && (
        <ContactSheet
          contact={selectedContact}
          open={showContactSheet}
          onOpenChange={setShowContactSheet}
        />
      )}

      <ContactsBulkActions
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
      />

      {consultantDialogContact && (
        <ChangeConsultantDialog
          open={!!consultantDialogContact}
          onOpenChange={(open) => !open && setConsultantDialogContact(null)}
          contactId={consultantDialogContact.id}
          contactName={`${consultantDialogContact.first_name} ${consultantDialogContact.last_name}`}
          currentConsultantId={consultantDialogContact.consultant_id}
        />
      )}

      {consultantSheet && (
        <ConsultantClientsSheet
          open={!!consultantSheet}
          onOpenChange={(open) => !open && setConsultantSheet(null)}
          consultantId={consultantSheet.id}
          consultantName={consultantSheet.name}
        />
      )}
    </PageContainer>
  );
}
