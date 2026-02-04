import { useState, useEffect, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useDepartments";
import { useUpdateUser } from "@/hooks/useUpdateUser";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useProfileSkills } from "@/hooks/useProfileSkills";
import { useUpdateProfileSkills } from "@/hooks/useUpdateProfileSkills";
import { useAgentSupportChannels } from "@/hooks/useAgentSupportChannels";
import { useUpdateAgentChannels } from "@/hooks/useUpdateAgentChannels";
import AvatarUploader from "@/components/AvatarUploader";
import SkillsMultiSelect from "@/components/SkillsMultiSelect";
import { SupportChannelsMultiSelect } from "@/components/SupportChannelsMultiSelect";
import { PremiumInput } from "@/components/ui/premium-input";
import { PasswordStrength, usePasswordStrength } from "@/components/ui/password-strength";
import { z } from "zod";
import { User, Mail, Lock, Briefcase, ShieldCheck, Loader2, Building2, Crown, Users, Headphones, DollarSign, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const userSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(8, { message: "Senha deve ter no mínimo 8 caracteres" }),
  role: z.enum(["admin", "general_manager", "manager", "sales_rep", "consultant", "support_agent", "support_manager", "financial_manager", "financial_agent", "cs_manager", "ecommerce_analyst"], { message: "Role inválida" }),
  full_name: z.string().min(1, { message: "Nome completo é obrigatório" }),
  department: z.string().uuid({ message: "Departamento inválido" }).optional().or(z.literal("")),
});

const editUserSchema = z.object({
  role: z.enum(["admin", "general_manager", "manager", "sales_rep", "consultant", "support_agent", "support_manager", "financial_manager", "financial_agent", "cs_manager", "ecommerce_analyst"], { message: "Role inválida" }),
  full_name: z.string().min(1, { message: "Nome completo é obrigatório" }),
  department: z.string().uuid({ message: "Departamento inválido" }).optional().or(z.literal("")),
});

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: "admin" | "general_manager" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager" | "financial_agent" | "cs_manager" | "ecommerce_analyst";
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

// Validation helpers
const validateEmail = (email: string): string | null => {
  if (!email) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "Formato de email inválido";
  return null;
};

const validateName = (name: string): string | null => {
  if (!name) return null;
  if (name.length < 2) return "Nome muito curto";
  return null;
};

export default function UserDialog({ open, onOpenChange, onSuccess, editUser }: UserDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "general_manager" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager" | "financial_agent" | "cs_manager" | "ecommerce_analyst">("sales_rep");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const { toast } = useToast();
  const { data: departments } = useDepartments();
  const updateUserMutation = useUpdateUser();
  const { uploadAvatar, uploading: uploadingAvatar } = useAvatarUpload();
  const { data: profileSkills } = useProfileSkills(editUser?.id);
  const updateProfileSkills = useUpdateProfileSkills();
  const { data: agentChannels } = useAgentSupportChannels(editUser?.id);
  const updateAgentChannels = useUpdateAgentChannels();
  const { strength: passwordStrength } = usePasswordStrength(password);

  const isEditMode = !!editUser;

  // Real-time validation errors
  const errors = {
    fullName: touched.fullName ? validateName(fullName) : null,
    email: touched.email ? validateEmail(email) : null,
    password: touched.password && password && password.length < 8 ? "Mínimo 8 caracteres" : null,
  };

  const isValid = {
    fullName: fullName.length >= 2,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    password: password.length >= 8,
  };

  // Populate form when editing - fetch fresh data from database
  useEffect(() => {
    const populateForm = async () => {
      if (editUser && open) {
        // Buscar dados atualizados diretamente do banco
        const { data: freshProfile } = await supabase
          .from('profiles')
          .select('full_name, job_title, department, avatar_url')
          .eq('id', editUser.id)
          .single();
        
        setEmail(editUser.email);
        setRole(editUser.role);
        setFullName(freshProfile?.full_name || editUser.full_name || "");
        setJobTitle(freshProfile?.job_title || editUser.job_title || "");
        setDepartment(freshProfile?.department || editUser.department || "");
        setSelectedSkills(profileSkills?.map(ps => ps.skill_id) || []);
        setSelectedChannels(agentChannels?.map(ac => ac.channel_id) || []);
      } else if (!open) {
        // Reset form when dialog closes
        setEmail("");
        setPassword("");
        setRole("sales_rep");
        setFullName("");
        setJobTitle("");
        setDepartment("");
        setSelectedSkills([]);
        setSelectedChannels([]);
        setTouched({});
      }
    };
    
    populateForm();
  }, [editUser, open, profileSkills, agentChannels]);

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

        // Atualizar canais (apenas para support_agent)
        if (role === 'support_agent') {
          await updateAgentChannels.mutateAsync({
            profileId: editUser.id,
            channelIds: selectedChannels,
          });
        }

        toast({
          title: "Usuário atualizado!",
          description: "As alterações foram salvas com sucesso.",
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
          financial_agent: "Agente Financeiro",
          cs_manager: "Gerente de CS",
          ecommerce_analyst: "Analista de E-commerce",
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
        setTouched({});
        onOpenChange(false);
        onSuccess();
      }
    } catch (error) {
      // Log estruturado para debug de permissões
      console.error("[UserDialog] Create/Update failed:", {
        mode: isEditMode ? 'edit' : 'create',
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        payload: { email, role, department, fullName }
      });
      
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
          description: `${error.message} (verifique o console para detalhes)`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: "admin", label: "Administrador (Super Admin)", description: "Acesso total + Infraestrutura", icon: Crown },
    { value: "general_manager", label: "Gerente Geral", description: "Operação completa (sem infra)", icon: Crown },
    { value: "manager", label: "Gerente de Vendas", description: "Vê todo o time", icon: Users },
    { value: "sales_rep", label: "Vendedor", description: "Apenas seus leads", icon: Users },
    { value: "consultant", label: "Consultor / Account Manager", description: "Carteira pós-venda", icon: Briefcase },
    { value: "support_agent", label: "Atendente / Solver", description: "Suporte e tickets", icon: Headphones },
    { value: "support_manager", label: "Gerente de Suporte", description: "Visão total + Gestão de equipe", icon: Headphones },
    { value: "financial_manager", label: "Gestor Financeiro", description: "Aprovação de reembolsos", icon: DollarSign },
    { value: "financial_agent", label: "Agente Financeiro", description: "Operacional financeiro", icon: DollarSign },
    { value: "cs_manager", label: "Gerente de CS", description: "Head of Success", icon: Users },
    { value: "ecommerce_analyst", label: "Analista de E-commerce", description: "Análise de vendas e métricas", icon: ShoppingCart },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-background via-background to-muted/20 border-0 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {isEditMode ? "Editar Usuário" : "Criar Novo Usuário"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEditMode 
              ? "Atualize as informações do usuário. O email não pode ser alterado."
              : "Adicione um novo usuário ao sistema. A senha será temporária e deverá ser alterada no primeiro acesso."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome e Email - Premium Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PremiumInput
              label="Nome Completo"
              icon={User}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setTouched(t => ({ ...t, fullName: true }));
              }}
              error={errors.fullName || undefined}
              success={isValid.fullName}
              required
            />

            <PremiumInput
              label="Email"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setTouched(t => ({ ...t, email: true }));
              }}
              error={errors.email || undefined}
              success={isValid.email}
              disabled={isEditMode}
              required={!isEditMode}
            />
          </div>

          {/* Avatar Upload - Premium Style */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Foto do Perfil</Label>
            <div className="p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-muted/30">
              <AvatarUploader
                currentAvatarUrl={editUser?.avatar_url}
                userName={fullName || "Usuário"}
                onFileSelect={setAvatarFile}
                uploading={uploadingAvatar}
              />
            </div>
          </div>

          {/* Cargo e Senha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PremiumInput
              label="Cargo (opcional)"
              icon={Briefcase}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              hint="Ex: Diretor Comercial"
            />

            {!isEditMode && (
              <div className="space-y-2">
                <PremiumInput
                  label="Senha Temporária"
                  icon={Lock}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setTouched(t => ({ ...t, password: true }));
                  }}
                  error={errors.password || undefined}
                  success={passwordStrength.level >= 3}
                  required
                />
                <PasswordStrength password={password} />
              </div>
            )}
          </div>

          {/* Perfil de Acesso - Premium Select */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Perfil de Acesso
            </Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)} required>
              <SelectTrigger className="h-14 rounded-xl border-2 hover:border-primary/40 transition-all">
                <SelectValue placeholder="Selecione o perfil..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {roleOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value} className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <IconComponent className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Departamento - Premium Select */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Departamento
            </Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-14 rounded-xl border-2 hover:border-primary/40 transition-all">
                <SelectValue placeholder="Selecione o departamento..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-80">
                {/* Departamentos principais (sem parent_id) */}
                {departments?.filter(d => d.is_active && !d.parent_id).map((dept) => {
                  // Buscar subdepartamentos
                  const children = departments?.filter(
                    child => child.is_active && child.parent_id === dept.id
                  );
                  
                  return (
                    <Fragment key={dept.id}>
                      {/* Departamento pai */}
                      <SelectItem value={dept.id} className="py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full ring-2 ring-offset-2 ring-offset-background"
                            style={{ backgroundColor: dept.color, boxShadow: `0 0 8px ${dept.color}40` }}
                          />
                          <span className="font-medium">{dept.name}</span>
                        </div>
                      </SelectItem>
                      
                      {/* Subdepartamentos com indentação */}
                      {children?.map((child) => (
                        <SelectItem key={child.id} value={child.id} className="py-2.5 pl-8">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: child.color, boxShadow: `0 0 6px ${child.color}40` }}
                            />
                            <span className="text-sm text-muted-foreground">{child.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </Fragment>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          {/* Habilidades - Apenas no modo edição */}
          {isEditMode && editUser && (
            <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border">
              <Label className="text-sm font-medium">Habilidades do Agente</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Selecione as habilidades para roteamento inteligente de conversas
              </p>
              <SkillsMultiSelect
                selectedSkillIds={selectedSkills}
                onSelectionChange={setSelectedSkills}
              />
            </div>
          )}

          {/* Canais de Atendimento - Apenas para support_agent no modo edição */}
          {isEditMode && editUser && role === 'support_agent' && (
            <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border">
              <Label className="text-sm font-medium">Canais de Atendimento</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Selecione os canais que este agente pode atender. Se nenhum canal for selecionado, o agente atenderá todos os canais.
              </p>
              <SupportChannelsMultiSelect
                selectedChannelIds={selectedChannels}
                onSelectionChange={setSelectedChannels}
              />
            </div>
          )}

          {/* Footer with Premium Button */}
          <div className="pt-4 space-y-4">
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                disabled={loading || uploadingAvatar}
                className="flex-1 h-12 rounded-xl border-2"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || uploadingAvatar}
                className={cn(
                  "flex-1 h-12 rounded-xl font-semibold text-base",
                  "bg-gradient-to-r from-primary to-success hover:from-primary/90 hover:to-success/90",
                  "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
                  "transition-all duration-300"
                )}
              >
                {loading || uploadingAvatar ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {isEditMode ? "Salvando..." : "Criando..."}
                  </>
                ) : (
                  isEditMode ? "Salvar Alterações" : "Criar Usuário"
                )}
              </Button>
            </div>

            {/* LGPD Trust Seal */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span>Seus dados estão protegidos (LGPD)</span>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
