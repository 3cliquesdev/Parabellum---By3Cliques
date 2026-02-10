import { useState, useCallback, useEffect } from "react";
import { useCreateTicket } from "@/hooks/useCreateTicket";
import { useSearchContactsForTicket } from "@/hooks/useSearchContactsForTicket";
import { useDepartments } from "@/hooks/useDepartments";
import { useTicketCategories } from "@/hooks/useTicketCategories";
import { useUsers } from "@/hooks/useUsers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTicketAttachmentUpload } from "@/hooks/useTicketAttachmentUpload";
import { useTags } from "@/hooks/useTags";
import { useTicketOperations } from "@/hooks/useTicketOperations";
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
  // createCategory removed - categories are managed via settings
  const { uploadFile, uploading, progress } = useTicketAttachmentUpload();
  const { data: operations = [] } = useTicketOperations();

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
  
  // Estado para anexo (agora opcional)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploadedAttachment, setUploadedAttachment] = useState<{ url: string; type: string; name: string } | null>(null);

  // Operação (obrigatório)
  const [operationId, setOperationId] = useState<string>("");

  // Tags
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const { data: allTags = [] } = useTags();

  // Debounce search to avoid query on every keystroke
  const debouncedSearch = useDebouncedValue(customerSearch, 300);
  
  // Optimized search via Edge Function (bypasses RLS for performance)
  const { data: contacts = [] } = useSearchContactsForTicket(debouncedSearch);

  const { data: users = [] } = useUsers();
  
  // Filtrar usuários que podem receber tickets (suporte + gestão + financeiro)
  // Filtrar usuários que podem receber tickets (suporte + gestão + financeiro + consultores)
  const supportUsers = users.filter(u => 
    ['support_agent', 'support_manager', 'admin', 'manager', 'general_manager', 'financial_manager', 'financial_agent', 'consultant', 'cs_manager'].includes(u.role) &&
    !u.is_blocked &&
    !u.is_archived
  );

  // Contacts already filtered server-side, just limit results
  const filteredContacts = contacts.slice(0, 10);

  const selectedContact = contacts.find((c) => c.id === customerId);

  // Dropzone para upload de imagem
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setAttachmentFile(file);
    
    // Criar preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachmentPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }

    // Fazer upload
    const result = await uploadFile(file);
    if (result) {
      setUploadedAttachment(result);
    }
  }, [uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setUploadedAttachment(null);
  };

  // Category creation removed - managed via settings

  // Evidência agora é sempre opcional

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
      attachments: uploadedAttachment ? [uploadedAttachment] : [],
      tag_ids: selectedTagIds,
      operation_id: operationId || undefined,
    });

    // Reset form
    setSubject("");
    setDescription("");
    setPriority("medium");
    setCategory("outro");
    setCustomerId("");
    setDepartmentId("");
    setAssignedTo("");
    setOperationId("");
    setCustomerSearch("");
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setUploadedAttachment(null);
    setSelectedTagIds([]);
    setTagSearch("");
    onOpenChange(false);
  };

  const activeDepartments = departments?.filter((d) => d.is_active) || [];

  const canSubmit = subject.trim() && operationId && !createTicket.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Criar Novo Ticket</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do ticket de suporte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Search */}
          <div className="space-y-2">
            <Label htmlFor="customer">
              Cliente
              <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
            </Label>
            {selectedContact ? (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-foreground">
                    {selectedContact.first_name} {selectedContact.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedContact.email}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomerId("");
                    setCustomerSearch("");
                  }}
                >
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
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Nenhum cliente encontrado
                      </p>
                    ) : (
                      <div className="divide-y">
                        {filteredContacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            className="w-full p-3 text-left hover:bg-muted transition-colors"
                            onClick={() => {
                              setCustomerId(contact.id);
                              setCustomerSearch("");
                            }}
                          >
                            <p className="font-medium">
                              {contact.first_name} {contact.last_name}
                            </p>
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
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Resumo do problema"
              required
            />
          </div>

          {/* Anexo - Evidência (opcional para saques) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Evidência (Print/Foto)
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
            
            {!attachmentFile ? (
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                `}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive ? (
                    "Solte o arquivo aqui..."
                  ) : (
                    <>
                      Arraste uma imagem ou <span className="text-primary font-medium">clique para selecionar</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, WEBP ou PDF até 10MB
                </p>
              </div>
            ) : (
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {attachmentPreview ? (
                      <img 
                        src={attachmentPreview} 
                        alt="Preview" 
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{attachmentFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(attachmentFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={removeAttachment}
                    disabled={uploading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {uploading && (
                  <div className="space-y-1">
                    <Progress value={progress} className="h-1" />
                    <p className="text-xs text-muted-foreground text-center">Enviando...</p>
                  </div>
                )}
                
                {uploadedAttachment && !uploading && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    ✓ Arquivo enviado com sucesso
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema em detalhes..."
              rows={3}
            />
          </div>

          {/* Category & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={category} 
                onValueChange={handleCategoryChange}
                disabled={categories.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={categories.length === 0 ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start"
                  sideOffset={4}
                  className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                >
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {categoryLabels[cat.name] || cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Input
                value={
                  priority === "low" ? "Baixa" :
                  priority === "medium" ? "Média" :
                  priority === "high" ? "Alta" :
                  priority === "urgent" ? "Urgente" : priority
                }
                readOnly
                className="bg-muted cursor-default"
              />
            </div>
          </div>

          {/* Operação (obrigatório) */}
          <div className="space-y-2">
            <Label>Operação *</Label>
            <Select value={operationId} onValueChange={setOperationId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a operação" />
              </SelectTrigger>
              <SelectContent 
                position="popper" 
                side="bottom" 
                align="start"
                sideOffset={4}
                className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
              >
                {operations.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              Tags
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
            
            {/* Badges das tags selecionadas */}
            {selectedTagIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedTagIds.map(tagId => {
                  const tag = allTags.find(t => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <Badge 
                      key={tagId} 
                      variant="secondary"
                      className="text-xs pr-1"
                      style={{
                        backgroundColor: tag.color ? `${tag.color}20` : undefined,
                        borderColor: tag.color || undefined,
                        color: tag.color || undefined,
                      }}
                    >
                      {tag.name}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                        onClick={() => setSelectedTagIds(prev => prev.filter(id => id !== tagId))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}
            
            {/* Popover para adicionar tags */}
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start text-muted-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar tag...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <Input
                  placeholder="Buscar tag..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  className="h-8 mb-2"
                />
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {allTags
                      .filter(tag => 
                        !selectedTagIds.includes(tag.id) &&
                        tag.name.toLowerCase().includes(tagSearch.toLowerCase())
                      )
                      .slice(0, 10)
                      .map(tag => (
                        <Button
                          key={tag.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-8 px-2"
                          onClick={() => {
                            setSelectedTagIds(prev => [...prev, tag.id]);
                            setTagSearch("");
                            setTagPopoverOpen(false);
                          }}
                        >
                          <span
                            className="w-3 h-3 rounded-full mr-2 shrink-0"
                            style={{ backgroundColor: tag.color || "hsl(var(--muted-foreground))" }}
                          />
                          <span className="truncate">{tag.name}</span>
                        </Button>
                      ))}
                    {allTags.filter(tag => 
                      !selectedTagIds.includes(tag.id) &&
                      tag.name.toLowerCase().includes(tagSearch.toLowerCase())
                    ).length === 0 && (
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
              <Label>Departamento</Label>
              <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start"
                  sideOffset={4}
                  className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                >
                  <SelectItem value="none">Nenhum</SelectItem>
                  {activeDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Atribuir a</Label>
              <Select value={assignedTo || "none"} onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent 
                  position="popper" 
                  side="bottom" 
                  align="start"
                  sideOffset={4}
                  className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
                >
                  <SelectItem value="none">Fila de Espera</SelectItem>
                  {supportUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createTicket.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                "Criar Ticket"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
