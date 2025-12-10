import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmailTemplate } from "@/hooks/useEmailTemplates";

interface MigrateTemplateButtonProps {
  template: EmailTemplate;
  onMigrated?: () => void;
}

export function MigrateTemplateButton({ template, onMigrated }: MigrateTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const { toast } = useToast();

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      // Create V2 template
      const { data: v2Template, error: templateError } = await supabase
        .from("email_templates_v2")
        .insert({
          name: `${template.name} (Migrado)`,
          description: `Migrado do template V1: ${template.name}`,
          default_subject: template.subject,
          trigger_type: template.trigger_type,
          is_active: template.is_active,
          branding_id: template.branding_id,
          department_id: template.department_id,
          sender_id: template.sender_id,
          legacy_template_id: template.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create HTML block with the original content
      const { error: blockError } = await supabase
        .from("email_template_blocks")
        .insert({
          template_id: v2Template.id,
          block_type: "html",
          position: 0,
          content: {
            html: template.html_body,
          },
          styles: {
            padding: "0px",
            backgroundColor: "transparent",
          },
        });

      if (blockError) throw blockError;

      toast({
        title: "Template migrado",
        description: `"${template.name}" foi convertido para V2 com sucesso.`,
      });

      setOpen(false);
      onMigrated?.();
    } catch (error: any) {
      toast({
        title: "Erro na migração",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Migrar para V2
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Migrar Template para V2</DialogTitle>
            <DialogDescription>
              O template "{template.name}" será convertido para o novo formato V2.
              O HTML original será preservado em um bloco HTML editável.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2 text-sm text-muted-foreground">
            <p>• O template V1 original será mantido</p>
            <p>• Um novo template V2 será criado com o sufixo "(Migrado)"</p>
            <p>• O conteúdo HTML será preservado integralmente</p>
            <p>• Você poderá editar o template no novo editor visual</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMigrate} disabled={migrating}>
              {migrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Migração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
