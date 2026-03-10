import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useUserRole } from "@/hooks/useUserRole";
import { hasFullAccess } from "@/config/roles";
import AvatarUploader from "@/components/AvatarUploader";
import { Bot, Send } from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().min(1, "Nome é obrigatório").max(100),
  job_title: z.string().max(100).optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileEditDialogProps {
  trigger: React.ReactNode;
}

export default function ProfileEditDialog({ trigger }: ProfileEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [notifyGovernor, setNotifyGovernor] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const { profile, user, refetchProfile } = useAuth();
  const { toast } = useToast();
  const { uploadAvatar, uploading: uploadingAvatar } = useAvatarUpload();
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      job_title: profile?.job_title || "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        full_name: profile.full_name,
        job_title: profile.job_title || "",
      });
      setWhatsappNumber((profile as any).whatsapp_number || "");
      setNotifyGovernor((profile as any).notify_ai_governor || false);
    }
  }, [profile, form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setLoading(true);
    try {
      let avatarUrl = profile?.avatar_url;
      if (avatarFile) {
        const uploadedUrl = await uploadAvatar(avatarFile, user.id);
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        }
      }

      const updatePayload: any = {
        full_name: data.full_name,
        job_title: data.job_title || null,
        avatar_url: avatarUrl || null,
      };

      if (hasFullAccess(role)) {
        updatePayload.whatsapp_number = whatsappNumber || null;
        updatePayload.notify_ai_governor = notifyGovernor;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id);

      if (error) throw error;

      await refetchProfile();
      queryClient.invalidateQueries({ queryKey: ["users"] });

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });

      setOpen(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar perfil",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendReport = async () => {
    setSendingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-governor", {
        body: { force_today: true },
      });

      if (error) throw error;

      toast({
        title: "Relatório enviado!",
        description: `Métricas coletadas: ${data?.metrics?.totalConvs ?? 0} conversas processadas.`,
      });
    } catch (error) {
      console.error("Error sending governor report:", error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar relatório",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Avatar Upload */}
            <div className="space-y-2">
              <FormLabel>Foto do Perfil</FormLabel>
              <AvatarUploader
                currentAvatarUrl={profile?.avatar_url}
                userName={form.watch("full_name") || "Usuário"}
                onFileSelect={setAvatarFile}
                uploading={uploadingAvatar}
              />
            </div>

            <FormField
              control={form.control}
              name="job_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Vendedor Sênior" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* IA Governante — Admin only */}
            {hasFullAccess(role) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">IA Governante</h3>
                  </div>

                  <div className="space-y-2">
                    <FormLabel>WhatsApp para notificações</FormLabel>
                    <Input
                      placeholder="5511999999999"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Número com código do país (ex: 5511999999999)
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Receber relatório diário da IA</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Receba um resumo executivo todo dia via WhatsApp
                      </p>
                    </div>
                    <Switch
                      checked={notifyGovernor}
                      onCheckedChange={setNotifyGovernor}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSendReport}
                    disabled={sendingReport}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendingReport ? "Enviando..." : "Enviar relatório agora"}
                  </Button>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading || uploadingAvatar}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || uploadingAvatar}>
                {loading || uploadingAvatar ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
