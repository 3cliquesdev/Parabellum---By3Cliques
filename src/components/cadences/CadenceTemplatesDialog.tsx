import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Users, Clock, ArrowRight, Mail, Linkedin, Phone, MessageSquare, CheckSquare } from "lucide-react";

interface CadenceTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTemplate: (steps: any[]) => void;
}

const categoryLabels: Record<string, { label: string; icon: any; color: string }> = {
  cold_outreach: { label: "Prospecção Fria", icon: Users, color: "bg-blue-500" },
  follow_up: { label: "Follow-up", icon: ArrowRight, color: "bg-green-500" },
  reengagement: { label: "Reengajamento", icon: Clock, color: "bg-cyan-500" },
  post_event: { label: "Pós-Evento", icon: Sparkles, color: "bg-purple-500" },
  upsell: { label: "Upsell", icon: ArrowRight, color: "bg-indigo-500" },
};

const stepTypeIcons: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  call: Phone,
  whatsapp: MessageSquare,
  task: CheckSquare,
  delay: Clock,
  sms: MessageSquare,
};

export function CadenceTemplatesDialog({ open, onOpenChange, onApplyTemplate }: CadenceTemplatesDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["cadence-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cadence_templates")
        .select("*")
        .eq("is_active", true)
        .order("category");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleApply = () => {
    if (selectedTemplate) {
      const steps = typeof selectedTemplate.steps === 'string' 
        ? JSON.parse(selectedTemplate.steps) 
        : selectedTemplate.steps;
      onApplyTemplate(steps);
      setSelectedTemplate(null);
    }
  };

  const parseSteps = (steps: unknown): any[] => {
    if (typeof steps === 'string') {
      try {
        return JSON.parse(steps);
      } catch {
        return [];
      }
    }
    return Array.isArray(steps) ? steps : [];
  };

  const getStepTypes = (steps: unknown): string[] => {
    const parsedSteps = parseSteps(steps);
    const types = parsedSteps
      .filter((s: any) => s.type !== 'delay')
      .map((s: any) => s.type);
    return [...new Set(types)] as string[];
  };

  const getTotalDays = (steps: unknown): number => {
    const parsedSteps = parseSteps(steps);
    return Math.max(...parsedSteps.map((s: any) => s.day_offset || 0), 0);
  };

  const getStepCount = (steps: unknown): number => {
    const parsedSteps = parseSteps(steps);
    return parsedSteps.filter((s: any) => s.type !== 'delay').length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Templates de Cadência
          </DialogTitle>
          <DialogDescription>
            Escolha um template pronto para acelerar sua prospecção
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 pb-4">
              {templates?.map((template) => {
                const category = categoryLabels[template.category] || categoryLabels.cold_outreach;
                const CategoryIcon = category.icon;
                const isSelected = selectedTemplate?.id === template.id;
                const stepTypes = getStepTypes(template.steps);

                return (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? "ring-2 ring-primary border-primary" : ""
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${category.color} flex items-center justify-center`}>
                            <CategoryIcon className="h-4 w-4 text-white" />
                          </div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {category.label}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm mt-2">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">
                            {getStepCount(template.steps)} passos
                          </span>
                          <span className="text-muted-foreground">
                            {getTotalDays(template.steps)} dias
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {stepTypes.slice(0, 4).map((type) => {
                            const Icon = stepTypeIcons[type];
                            return Icon ? (
                              <div
                                key={type}
                                className="w-6 h-6 rounded bg-muted flex items-center justify-center"
                              >
                                <Icon className="h-3 w-3 text-muted-foreground" />
                              </div>
                            ) : null;
                          })}
                          {stepTypes.length > 4 && (
                            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                              +{stepTypes.length - 4}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Preview steps when selected */}
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-medium mb-2">Prévia dos Passos:</h4>
                          <div className="space-y-2 max-h-40 overflow-auto">
                            {parseSteps(template.steps).map((step: any, index: number) => {
                              const Icon = stepTypeIcons[step.type] || CheckSquare;
                              return (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <span className="text-muted-foreground">Dia {step.day_offset}:</span>
                                  <span className="truncate">{step.title}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={!selectedTemplate} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Usar Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
