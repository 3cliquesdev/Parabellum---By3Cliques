import { useState, useCallback, useEffect } from "react";
import { useCreateTicket } from "@/hooks/useCreateTicket";
import { useContacts } from "@/hooks/useContacts";
import { useDepartments } from "@/hooks/useDepartments";
import { useTicketCategories, useCreateTicketCategory } from "@/hooks/useTicketCategories";
import { useUsers } from "@/hooks/useUsers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTicketAttachmentUpload } from "@/hooks/useTicketAttachmentUpload";
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
import { Loader2, Search, Plus, Upload, X, Image as ImageIcon } from "lucide-react";
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
  const createCategory = useCreateTicketCategory();
  const { uploadFile, uploading, progress } = useTicketAttachmentUpload();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>("medium");
  const [category, setCategory] = useState<string>("");
  
  // Definir categoria inicial quando categorias carregarem
  useEffect(() => {
    if (categories.length > 0 && !category) {
      const defaultCat = categories.find(c => c.name === 'outro') || categories[0];
      setCategory(defaultCat.name);
    }
  }, [categories, category]);
  const [customerId, setCustomerId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  
  // Estado para anexo obrigatório
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploadedAttachment, setUploadedAttachment] = useState<{ url: string; type: string; name: string } | null>(null);

  // Debounce search to avoid query on every keystroke
  const debouncedSearch = useDebouncedValue(customerSearch, 300);
  
  // Server-side search - only query when there's a search term
  const { data: contacts = [] } = useContacts(
    debouncedSearch.length >= 2 ? { searchQuery: debouncedSearch } : undefined
  );

  const { data: users = [] } = useUsers();
  
  // Filtrar usuários que podem receber tickets (suporte + gestão + financeiro)
  const supportUsers = users.filter(u => 
    ['support_agent', 'support_manager', 'admin', 'manager', 'general_manager', 'financial_manager', 'financial_agent'].includes(u.role) &&
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

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    await createCategory.mutateAsync({ name: newCategoryName.trim().toLowerCase().replace(/\s+/g, '_') });
    setNewCategoryName("");
    setShowNewCategory(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !customerId || !uploadedAttachment) return;

    await createTicket.mutateAsync({
      subject: subject.trim(),
      description: description.trim(),
      priority,
      category,
      customer_id: customerId,
      department_id: departmentId || undefined,
      assigned_to: assignedTo || undefined,
      attachments: [uploadedAttachment],
    });

    // Reset form
    setSubject("");
    setDescription("");
    setPriority("medium");
    setCategory("outro");
    setCustomerId("");
    setDepartmentId("");
    setAssignedTo("");
    setCustomerSearch("");
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setUploadedAttachment(null);
    onOpenChange(false);
  };

  const activeDepartments = departments?.filter((d) => d.is_active) || [];

  const canSubmit = customerId && subject.trim() && uploadedAttachment && !createTicket.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Ticket</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do ticket de suporte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Search */}
          <div className="space-y-2">
            <Label htmlFor="customer">Cliente *</Label>
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

          {/* Anexo Obrigatório - Evidência */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Evidência (Print/Foto) *
              <span className="text-xs text-destructive font-normal">(obrigatório)</span>
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

          {/* Priority & Category Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Categoria</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setShowNewCategory(!showNewCategory)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Nova
                </Button>
              </div>
              {showNewCategory ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCategory}
                    disabled={createCategory.isPending}
                  >
                    {createCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
                  </Button>
                </div>
              ) : (
              <Select 
                  value={category} 
                  onValueChange={setCategory}
                  disabled={categories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={categories.length === 0 ? "Carregando..." : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {categoryLabels[cat.name] || cat.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Carregando categorias...
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Department & Assign Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
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
                <SelectContent>
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
