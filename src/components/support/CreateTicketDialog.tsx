import { useState, useCallback, useEffect } from "react";
import { useCreateTicket } from "@/hooks/useCreateTicket";
import { useSearchContactsForTicket } from "@/hooks/useSearchContactsForTicket";
import { useDepartments } from "@/hooks/useDepartments";
import { useTicketCategories } from "@/hooks/useTicketCategories";
import { useUsers } from "@/hooks/useUsers";
import { useUsersByDepartment } from "@/hooks/useUsersByDepartment";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTicketAttachmentUpload } from "@/hooks/useTicketAttachmentUpload";
import { useTags } from "@/hooks/useTags";
import { useTicketOperations } from "@/hooks/useTicketOperations";
import { useTicketOrigins } from "@/hooks/useTicketOrigins";
import { useTicketFieldSettings } from "@/hooks/useTicketFieldSettings";
import { useDropzone } from "react-dropzone";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Search, Plus, Upload, X, Image as ImageIcon, Tag } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Labels amigáveis para categorias
const categoryLabels: Record<string, string> = {
  duvida: "Dúvida",
  problema_tecnico: "Problema Técnico",
  financeiro: "Financeiro",
  sugestao: "Sugestão",
  reclamacao: "Reclamação",
  saque: "Saque",
  outro: "Outro",
};

export function CreateTicketDialog({ open, onOpenChange }: CreateTicketDialogProps) {
  const createTicket = useCreateTicket();
  const { data: departments = [] } = useDepartments();
  const { data: categories = [] } = useTicketCategories();
  const { uploadFile, uploading, progress } = useTicketAttachmentUpload();
  const { data: operations = [] } = useTicketOperations();
  const { data: origins = [] } = useTicketOrigins();
  const activeOrigins = origins.filter((o: any) => o.is_active);
  const { settings: fieldSettings, visibility: fieldVisibility } = useTicketFieldSettings();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [category, setCategory] = useState<string>("");
  
  // Auto-set category and priority from category
  useEffect(() => {
    if (categories.length > 0 && !category) {
      const defaultCat = categories.find(c => c.name === 'outro') || categories[0];
      setCategory(defaultCat.name);
      setPriority((defaultCat as any).priority || "medium");
    }
  }, [categories, category]);

  // When category changes, auto-fill priority from category
  const handleCategoryChange = (catName: string) => {
    setCategory(catName);
    const selectedCat = categories.find(c => c.name === catName);
    if (selectedCat) {
      setPriority((selectedCat as any).priority || "medium");
    }
  };
  const [customerId, setCustomerId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assignedPopoverOpen, setAssignedPopoverOpen] = useState(false);
  
  const [uploadedAttachments, setUploadedAttachments] = useState<Array<{ url: string; type: string; name: string; preview?: string }>>([]);

  const [operationId, setOperationId] = useState<string>("");
  const [originId, setOriginId] = useState<string>("");

  // Tags
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const { data: allTags = [] } = useTags();

  const debouncedSearch = useDebouncedValue(customerSearch, 300);
  const { data: contacts = [] } = useSearchContactsForTicket(debouncedSearch);
  const { data: users = [] } = useUsers();
  const { data: departmentUsers = [] } = useUsersByDepartment(departmentId || undefined);
  
  const supportUsers = users.filter(u => 
    ['support_agent', 'support_manager', 'admin', 'manager', 'general_manager', 'financial_manager', 'financial_agent', 'consultant', 'cs_manager'].includes(u.role) &&
    !u.is_blocked &&
    !u.is_archived
  );

  // Reset assignedTo when department changes
  useEffect(() => {
    setAssignedTo("");
  }, [departmentId]);

  // Build filtered + sorted user list for "Atribuir a"
  const assignableUsers = (() => {
    const baseList = departmentId
      ? departmentUsers.map(u => ({ id: u.id, full_name: u.full_name, email: null }))
      : supportUsers.map(u => ({ id: u.id, full_name: u.full_name, email: u.email }));
    
    return baseList
      .filter(u => {
        if (!assignedSearch) return true;
        return (u.full_name || '').toLowerCase().includes(assignedSearch.toLowerCase());
      })
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  })();

  const filteredContacts = contacts.slice(0, 10);
  const [selectedContact, setSelectedContact] = useState<{ id: string; first_name: string; last_name: string; email: string | null } | null>(null);

  // Dropzone para upload de múltiplas evidências
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const result = await uploadFile(file);
      if (result) {
        let preview: string | undefined;
        if (file.type.startsWith('image/')) {
          preview = URL.createObjectURL(file);
        }
        setUploadedAttachments(prev => [...prev, { ...result, preview }]);
      }
    }
  }, [uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
  });

  const removeAttachment = (index: number) => {
    setUploadedAttachments(prev => {
      const item = prev[index];
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    await createTicket.mutateAsync({
      subject: subject.trim(),
      description: description.trim(),
      priority: priority as 'low' | 'medium' | 'high' | 'urgent',
      category,
      customer_id: customerId || undefined,
      department_id: departmentId || undefined,
      assigned_to: assignedTo || undefined,
      attachments: uploadedAttachments.map(({ preview, ...rest }) => rest),
      tag_ids: selectedTagIds,
      operation_id: operationId || undefined,
      origin_id: originId || undefined,
    });
    setSubject("");
    setDescription("");
    setPriority("medium");
    setCategory("outro");
    setCustomerId("");
    setDepartmentId("");
    setAssignedTo("");
    setOperationId("");
    setOriginId("");
    setCustomerSearch("");
    setSelectedContact(null);
    setUploadedAttachments([]);
    setSelectedTagIds([]);
    setTagSearch("");
    onOpenChange(false);
  };

  const activeDepartments = departments?.filter((d) => d.is_active) || [];

  const canSubmit =
    subject.trim() &&
    (!fieldSettings.operation || operationId) &&
    (!fieldSettings.origin || originId) &&
    (!fieldSettings.department || departmentId) &&
    (!fieldSettings.category || category) &&
    (!fieldSettings.customer || customerId) &&
    (!fieldSettings.assigned_to || assignedTo) &&
    (!fieldSettings.tags || selectedTagIds.length > 0) &&
    !createTicket.isPending;

  // Helper for field label
  const fieldLabel = (label: string, field: keyof typeof fieldSettings) => (
    <>
      {label}
      {fieldSettings[field]
        ? <span className="text-destructive ml-0.5">*</span>
        : <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
      }
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Ticket</DialogTitle>
          <DialogDescription>Preencha os detalhes do ticket de suporte.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Search */}
          <div className="space-y-2">
            <Label htmlFor="customer">{fieldLabel("Cliente", "customer")}</Label>
            {selectedContact ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-foreground">
                    {selectedContact.first_name} {selectedContact.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedContact.email}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomerId(""); setSelectedContact(null); setCustomerSearch(""); }}>
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente por nome ou email..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {customerSearch && (
                  <ScrollArea className="h-40 border rounded-lg">
                    {filteredContacts.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground text-center">Nenhum cliente encontrado</p>
                    ) : (
                      <div className="divide-y">
                        {filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            className="w-full p-3 text-left hover:bg-muted transition-colors"
                            onClick={() => { setCustomerId(contact.id); setSelectedContact(contact); setCustomerSearch(""); }}
                          >
                            <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                            <p className="text-sm text-muted-foreground">{contact.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto *</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumo do problema" required />
          </div>

          {/* Evidências */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Evidências (Print/Foto)
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              {uploadedAttachments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{uploadedAttachments.length}</Badge>
              )}
            </Label>

            {/* Grid de arquivos já enviados */}
            {uploadedAttachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {uploadedAttachments.map((att, index) => (
                  <div key={index} className="relative group border rounded-lg overflow-hidden">
                    {att.preview ? (
                      <img src={att.preview} alt={att.name} className="w-full h-20 object-cover" />
                    ) : (
                      <div className="w-full h-20 bg-muted flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      type="button" variant="destructive" size="icon"
                      className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">{att.name}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Dropzone sempre visível */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="space-y-1">
                  <Progress value={progress} className="h-1" />
                  <p className="text-xs text-muted-foreground">Enviando...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {isDragActive ? "Solte aqui..." : <>Arraste ou <span className="text-primary font-medium">clique</span> para adicionar</>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP, PDF (máx 10MB cada)</p>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o problema em detalhes..." rows={3} />
          </div>

          {/* Category & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{fieldLabel("Categoria", "category")}</Label>
              <Select value={category} onValueChange={handleCategoryChange} disabled={categories.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={categories.length === 0 ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>{categoryLabels[cat.name] || cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Input
                value={priority === "low" ? "Baixa" : priority === "medium" ? "Média" : priority === "high" ? "Alta" : priority === "urgent" ? "Urgente" : priority}
                readOnly
                className="bg-muted cursor-default"
              />
            </div>
          </div>

          {/* Operação */}
          <div className="space-y-2">
            <Label>{fieldLabel("Operação", "operation")}</Label>
            <Select value={operationId} onValueChange={setOperationId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a operação" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                {operations.map((op) => (
                  <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origem do Ticket */}
          <div className="space-y-2">
            <Label>{fieldLabel("Origem do Ticket", "origin")}</Label>
            <Select value={originId} onValueChange={setOriginId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem (jornada do cliente)" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                {activeOrigins.map((origin: any) => (
                  <SelectItem key={origin.id} value={origin.id}>{origin.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              {fieldLabel("Tags", "tags")}
            </Label>
            {selectedTagIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedTagIds.map(tagId => {
                  const tag = allTags.find(t => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <Badge key={tagId} variant="secondary" className="text-xs pr-1"
                      style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined, borderColor: tag.color || undefined, color: tag.color || undefined }}>
                      {tag.name}
                      <Button type="button" variant="ghost" size="sm" className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                        onClick={() => setSelectedTagIds(prev => prev.filter(id => id !== tagId))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full justify-start text-muted-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar tag...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <Input placeholder="Buscar tag..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} className="h-8 mb-2" />
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {allTags
                      .filter(tag => !selectedTagIds.includes(tag.id) && tag.name.toLowerCase().includes(tagSearch.toLowerCase()))
                      .slice(0, 10)
                      .map(tag => (
                        <Button key={tag.id} type="button" variant="ghost" size="sm" className="w-full justify-start h-8 px-2"
                          onClick={() => { setSelectedTagIds(prev => [...prev, tag.id]); setTagSearch(""); setTagPopoverOpen(false); }}>
                          <span className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: tag.color || "hsl(var(--muted-foreground))" }} />
                          <span className="truncate">{tag.name}</span>
                        </Button>
                      ))}
                    {allTags.filter(tag => !selectedTagIds.includes(tag.id) && tag.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        {allTags.length === 0 ? "Nenhuma tag cadastrada" : "Nenhuma tag encontrada"}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          {/* Department & Assign Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{fieldLabel("Departamento", "department")}</Label>
              <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border">
                  <SelectItem value="none">Nenhum</SelectItem>
                  {activeDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{fieldLabel("Atribuir a", "assigned_to")}</Label>
              <Popover open={assignedPopoverOpen} onOpenChange={setAssignedPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start font-normal text-sm h-10">
                    {assignedTo
                      ? (assignableUsers.find(u => u.id === assignedTo)?.full_name
                        || supportUsers.find(u => u.id === assignedTo)?.full_name
                        || "Selecionado")
                      : <span className="text-muted-foreground">Fila de Espera</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <Input
                    placeholder="Buscar por nome..."
                    value={assignedSearch}
                    onChange={(e) => setAssignedSearch(e.target.value)}
                    className="h-8 mb-2"
                  />
                  <div
                    className="h-48 overflow-y-auto overscroll-contain pr-1"
                    style={{ touchAction: 'pan-y' }}
                    onWheelCapture={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.scrollTop += e.deltaY;
                    }}
                  >
                    <div className="space-y-1">
                      <Button
                        type="button" variant={!assignedTo ? "secondary" : "ghost"} size="sm"
                        className="w-full justify-start h-8 px-2"
                        onClick={() => { setAssignedTo(""); setAssignedSearch(""); setAssignedPopoverOpen(false); }}
                      >
                        Fila de Espera
                      </Button>
                      {assignableUsers.map((user) => (
                        <Button
                          key={user.id} type="button"
                          variant={assignedTo === user.id ? "secondary" : "ghost"}
                          size="sm" className="w-full justify-start h-8 px-2"
                          onClick={() => { setAssignedTo(user.id); setAssignedSearch(""); setAssignedPopoverOpen(false); }}
                        >
                          <span className="truncate">{user.full_name || user.email || user.id}</span>
                        </Button>
                      ))}
                      {assignableUsers.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">Nenhum agente encontrado</p>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!canSubmit}>
              {createTicket.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Criando...</>
              ) : "Criar Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
