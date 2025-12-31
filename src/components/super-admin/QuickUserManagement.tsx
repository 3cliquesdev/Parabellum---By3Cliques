import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, ExternalLink, Shield, ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function QuickUserManagement() {
  const navigate = useNavigate();

  const { data: users, isLoading } = useQuery({
    queryKey: ["super-admin-recent-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title, is_blocked, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Gestão de Usuários
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => navigate("/users")}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Ver todos
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Carregando...</div>
        ) : (
          <>
            {/* Lista de usuários recentes */}
            <div className="space-y-2">
              {users?.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{user.job_title || "Sem cargo"}</p>
                    </div>
                  </div>
                  {user.is_blocked ? (
                    <Badge variant="destructive" className="text-xs">
                      <ShieldOff className="h-3 w-3 mr-1" />
                      Bloqueado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Shield className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            {/* Botão de criar usuário */}
            <Button className="w-full mt-4" onClick={() => navigate("/users")}>
              <Plus className="h-4 w-4 mr-2" />
              Gerenciar Usuários
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
