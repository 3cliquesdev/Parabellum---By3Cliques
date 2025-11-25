import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useDepartments";
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(8, { message: "Senha deve ter no mínimo 8 caracteres" }),
  role: z.enum(["admin", "manager", "sales_rep", "consultant"], { message: "Role inválida" }),
  full_name: z.string().min(1, { message: "Nome completo é obrigatório" }),
  department: z.string().uuid({ message: "Departamento inválido" }),
});

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function UserDialog({ open, onOpenChange, onSuccess }: UserDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "sales_rep" | "consultant">("sales_rep");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { data: departments } = useDepartments();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      userSchema.parse({ email, password, role, full_name: fullName, department });

      console.log("Criando usuário:", { email, role, full_name: fullName, department });

      // Call Edge Function to create user (secure server-side operation)
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          role,
          full_name: fullName,
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

      const roleLabels = {
        admin: "Administrador",
        manager: "Gerente de Vendas",
        sales_rep: "Vendedor",
        consultant: "Consultor",
      };

      toast({
        title: "Usuário criado com sucesso!",
        description: `${email} foi criado como ${roleLabels[role]}.`,
      });

      setEmail("");
      setPassword("");
      setRole("sales_rep");
      setFullName("");
      setDepartment("");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating user:", error);
      
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Erro de validação",
          description: error.errors[0].message,
        });
      } else if (error instanceof Error) {
        toast({
          variant: "destructive",
          title: "Erro ao criar usuário",
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
          <DialogDescription>
            Adicione um novo usuário ao sistema. A senha será temporária e o usuário poderá alterá-la após o primeiro login.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
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
                required
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="role">Perfil de Acesso *</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex flex-col">
                      <span className="font-medium">Administrador</span>
                      <span className="text-xs text-muted-foreground">Acesso total ao sistema</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="manager">
                    <div className="flex flex-col">
                      <span className="font-medium">Gerente de Vendas</span>
                      <span className="text-xs text-muted-foreground">Vê todo o time e métricas gerais</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sales_rep">
                    <div className="flex flex-col">
                      <span className="font-medium">Vendedor</span>
                      <span className="text-xs text-muted-foreground">Apenas seus leads e métricas pessoais</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="consultant">
                    <div className="flex flex-col">
                      <span className="font-medium">Consultor / Account Manager</span>
                      <span className="text-xs text-muted-foreground">Gerencia carteira de clientes pós-venda</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
