import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useDepartments";
import { useUpdateUser } from "@/hooks/useUpdateUser";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useProfileSkills } from "@/hooks/useProfileSkills";
import { useUpdateProfileSkills } from "@/hooks/useUpdateProfileSkills";
import AvatarUploader from "@/components/AvatarUploader";
import SkillsMultiSelect from "@/components/SkillsMultiSelect";
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(8, { message: "Senha deve ter no mínimo 8 caracteres" }),
  role: z.enum(["admin", "general_manager", "manager", "sales_rep", "consultant", "support_agent", "support_manager", "financial_manager", "cs_manager"], { message: "Role inválida" }),
  full_name: z.string().min(1, { message: "Nome completo é obrigatório" }),
  department: z.string().uuid({ message: "Departamento inválido" }),
});

const editUserSchema = z.object({
  role: z.enum(["admin", "general_manager", "manager", "sales_rep", "consultant", "support_agent", "support_manager", "financial_manager", "cs_manager"], { message: "Role inválida" }),
  full_name: z.string().min(1, { message: "Nome completo é obrigatório" }),
  department: z.string().uuid({ message: "Departamento inválido" }),
});

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: "admin" | "general_manager" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager" | "cs_manager";
  full_name?: string;
  job_title?: string;
  avatar_url?: string;
  department?: string;
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editUser?: UserWithRole | null;
}

export default function UserDialog({ open, onOpenChange, onSuccess, editUser }: UserDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "general_manager" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager" | "cs_manager">("sales_rep");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { data: departments } = useDepartments();
  const updateUserMutation = useUpdateUser();
  const { uploadAvatar, uploading: uploadingAvatar } = useAvatarUpload();
  const { data: profileSkills } = useProfileSkills(editUser?.id);
  const updateProfileSkills = useUpdateProfileSkills();

  const isEditMode = !!editUser;

  // Populate form when editing
  useEffect(() => {
    if (editUser) {
      setEmail(editUser.email);
      setRole(editUser.role);
      setFullName(editUser.full_name || "");
      setJobTitle(editUser.job_title || "");
      setDepartment(editUser.department || "");
      setSelectedSkills(profileSkills?.map(ps => ps.skill_id) || []);
    } else {
      // Reset form for creation mode
      setEmail("");
      setPassword("");
      setRole("sales_rep");
      setFullName("");
      setJobTitle("");
      setDepartment("");
      setSelectedSkills([]);
    }
  }, [editUser, open, profileSkills]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditMode && editUser) {
        // Edit mode - validate without password
        editUserSchema.parse({ role, full_name: fullName, department });

        console.log("Atualizando usuário:", { user_id: editUser.id, role, full_name: fullName, job_title: jobTitle, department });

        // Upload avatar se houver arquivo selecionado
        let avatarUrl = editUser.avatar_url;
        if (avatarFile) {
          const uploadedUrl = await uploadAvatar(avatarFile, editUser.id);
          if (uploadedUrl) {
            avatarUrl = uploadedUrl;
            
            // Atualizar avatar_url no perfil
            await supabase
              .from("profiles")
              .update({ avatar_url: uploadedUrl })
              .eq("id", editUser.id);
          }
        }

        await updateUserMutation.mutateAsync({
          user_id: editUser.id,
          role,
          full_name: fullName,
          job_title: jobTitle || undefined,
          department,
        });
        
        // Atualizar skills
        await updateProfileSkills.mutateAsync({
          profileId: editUser.id,
          skillIds: selectedSkills,
        });

        onOpenChange(false);
        onSuccess();
      } else {
        // Create mode - validate with password
        userSchema.parse({ email, password, role, full_name: fullName, department });

        console.log("Criando usuário:", { email, role, full_name: fullName, department });

        // Call Edge Function to create user (secure server-side operation)
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email,
            password,
            role,
            full_name: fullName,
            job_title: jobTitle || undefined,
            department,
          }
        });

        if (error) {
          console.error("Edge Function error:", error);
          throw new Error(error.message || "Erro ao chamar função de criação");
        }

        if (!data?.success) {
          throw new Error(data?.error || "Falha ao criar usuário");
        }

        console.log("Usuário criado com sucesso:", data.user);

        // Upload avatar se houver arquivo selecionado
        if (avatarFile && data.user?.id) {
          const uploadedUrl = await uploadAvatar(avatarFile, data.user.id);
          if (uploadedUrl) {
            // Atualizar avatar_url no perfil
            await supabase
              .from("profiles")
              .update({ avatar_url: uploadedUrl })
              .eq("id", data.user.id);
          }
        }

        const roleLabels: Record<string, string> = {
          admin: "Administrador",
          general_manager: "Gerente Geral",
          manager: "Gerente de Vendas",
          sales_rep: "Vendedor",
          consultant: "Consultor / Account Manager",
          support_agent: "Atendente / Solver",
          support_manager: "Gerente de Suporte",
          financial_manager: "Gestor Financeiro",
          cs_manager: "Gerente de CS",
        };

        toast({
          title: "Usuário criado com sucesso!",
          description: `${email} foi criado como ${roleLabels[role]}.`,
        });

        setEmail("");
        setPassword("");
        setRole("sales_rep");
        setFullName("");
        setJobTitle("");
        setDepartment("");
        setAvatarFile(null);
        onOpenChange(false);
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting user:", error);
      
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Erro de validação",
          description: error.errors[0].message,
        });
      } else if (error instanceof Error) {
        toast({
          variant: "destructive",
          title: isEditMode ? "Erro ao atualizar usuário" : "Erro ao criar usuário",
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEditMode ? "Editar Usuário" : "Criar Novo Usuário"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEditMode 
              ? "Atualize as informações do usuário. O email não pode ser alterado."
              : "Adicione um novo usuário ao sistema. A senha será temporária e deverá ser alterada no primeiro acesso."
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Nome e Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="João Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isEditMode}
                  required={!isEditMode}
                />
              </div>
            </div>
            
            {/* Avatar Upload */}
            <div className="space-y-2">
              <Label>Foto do Perfil</Label>
              <AvatarUploader
                currentAvatarUrl={editUser?.avatar_url}
                userName={fullName || "Usuário"}
                onFileSelect={setAvatarFile}
                uploading={uploadingAvatar}
              />
            </div>

            {/* Cargo e Senha/Perfil */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">Cargo (opcional)</Label>
                <Input
                  id="job_title"
                  type="text"
                  placeholder="Vendedor"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>

              {!isEditMode && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha Temporária</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {/* Perfil de Acesso */}
            <div className="space-y-2">
              <Label htmlFor="role">Perfil de Acesso *</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex flex-col">
                      <span className="font-medium">👑 Administrador (Super Admin)</span>
                      <span className="text-xs text-muted-foreground">Acesso total + Infraestrutura</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="general_manager">
                    <div className="flex flex-col">
                      <span className="font-medium">🎖️ Gerente Geral</span>
                      <span className="text-xs text-muted-foreground">Operação completa (sem infra)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="manager">
                    <div className="flex flex-col">
                      <span className="font-medium">Gerente de Vendas</span>
                      <span className="text-xs text-muted-foreground">Vê todo o time</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sales_rep">
                    <div className="flex flex-col">
                      <span className="font-medium">Vendedor</span>
                      <span className="text-xs text-muted-foreground">Apenas seus leads</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="consultant">
                    <div className="flex flex-col">
                      <span className="font-medium">Consultor / Account Manager</span>
                      <span className="text-xs text-muted-foreground">Carteira pós-venda</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="support_agent">
                    <div className="flex flex-col">
                      <span className="font-medium">🛡️ Atendente / Solver</span>
                      <span className="text-xs text-muted-foreground">Suporte e tickets</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="support_manager">
                    <div className="flex flex-col">
                      <span className="font-medium">🛡️👔 Gerente de Suporte</span>
                      <span className="text-xs text-muted-foreground">Visão total + Gestão de equipe</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="financial_manager">
                    <div className="flex flex-col">
                      <span className="font-medium">💰 Gestor Financeiro</span>
                      <span className="text-xs text-muted-foreground">Aprovação de reembolsos</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cs_manager">
                    <div className="flex flex-col">
                      <span className="font-medium">👔 Gerente de CS</span>
                      <span className="text-xs text-muted-foreground">Head of Success</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Departamento */}
            <div className="space-y-2">
              <Label htmlFor="department">Departamento *</Label>
              <Select value={department || undefined} onValueChange={setDepartment} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento..." />
                </SelectTrigger>
                <SelectContent>
                  {departments?.filter(d => d.is_active).map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: dept.color }}
                        />
                        {dept.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Habilidades - Apenas no modo edição */}
            {isEditMode && editUser && (
              <div className="space-y-2">
                <Label>Habilidades do Agente</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Selecione as habilidades para roteamento inteligente de conversas
                </p>
                <SkillsMultiSelect
                  selectedSkillIds={selectedSkills}
                  onSelectionChange={setSelectedSkills}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || uploadingAvatar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploadingAvatar}>
              {loading || uploadingAvatar ? (isEditMode ? "Salvando..." : "Criando...") : (isEditMode ? "Salvar Alterações" : "Criar Usuário")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
