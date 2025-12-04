import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";
import { usePipelines } from "@/hooks/usePipelines";
import { useSalesReps } from "@/hooks/useSalesReps";
import { Briefcase, Ticket, FileText, Users, Target, Bell } from "lucide-react";

export type FormTargetType = "deal" | "ticket" | "internal_request";
export type FormDistributionRule = "round_robin" | "manager_only" | "specific_user";

export interface FormRoutingSettings {
  target_type: FormTargetType;
  target_department_id?: string;
  target_pipeline_id?: string;
  target_user_id?: string;
  distribution_rule: FormDistributionRule;
  notify_manager: boolean;
}

interface FormRoutingConfigProps {
  settings: FormRoutingSettings;
  onChange: (settings: FormRoutingSettings) => void;
}

const TARGET_TYPE_OPTIONS = [
  { value: "deal", label: "Lead/Negócio", icon: Briefcase, description: "Criar oportunidade no funil de vendas" },
  { value: "ticket", label: "Ticket de Suporte", icon: Ticket, description: "Criar chamado na fila de suporte" },
  { value: "internal_request", label: "Solicitação Interna", icon: FileText, description: "Criar tarefa interna (RH, Financeiro)" },
];

const DISTRIBUTION_OPTIONS = [
  { value: "round_robin", label: "Distribuir Igualmente", description: "Distribuir entre todos do setor" },
  { value: "manager_only", label: "Apenas Gestor", description: "Enviar somente para o gestor" },
  { value: "specific_user", label: "Usuário Específico", description: "Fixar em um responsável" },
];

export function FormRoutingConfig({ settings, onChange }: FormRoutingConfigProps) {
  const { data: departments } = useDepartments();
  const { data: pipelines } = usePipelines();
  const { data: salesReps } = useSalesReps();

  const updateSetting = <K extends keyof FormRoutingSettings>(
    key: K,
    value: FormRoutingSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  const selectedTargetType = TARGET_TYPE_OPTIONS.find(t => t.value === settings.target_type);
  const isTicketMode = settings.target_type === "ticket";

  return (
    <Card className={isTicketMode ? "border-orange-500/30" : ""}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Configuração de Destino
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Type */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Ao enviar, criar o quê?</Label>
          <div className="grid gap-2">
            {TARGET_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = settings.target_type === option.value;
              const isTicket = option.value === "ticket";
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateSetting("target_type", option.value as FormTargetType)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? isTicket 
                        ? "border-orange-500 bg-orange-500/5"
                        : "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className={`p-2 rounded-md ${
                    isSelected 
                      ? isTicket ? "bg-orange-500/10" : "bg-primary/10" 
                      : "bg-muted"
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      isSelected 
                        ? isTicket ? "text-orange-500" : "text-primary" 
                        : "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      isSelected 
                        ? isTicket ? "text-orange-500" : "text-primary" 
                        : "text-foreground"
                    }`}>
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Department Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {isTicketMode ? "Departamento de Destino" : "Enviar para qual setor?"}
          </Label>
          <Select
            value={settings.target_department_id || ""}
            onValueChange={(v) => updateSetting("target_department_id", v || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o departamento..." />
            </SelectTrigger>
            <SelectContent>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isTicketMode && (
            <p className="text-xs text-muted-foreground">
              Ex: Financeiro, Logística, Suporte Técnico
            </p>
          )}
        </div>

        {/* Pipeline Selection (only for deals) */}
        {settings.target_type === "deal" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Pipeline de destino</Label>
            <Select
              value={settings.target_pipeline_id || ""}
              onValueChange={(v) => updateSetting("target_pipeline_id", v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pipeline..." />
              </SelectTrigger>
              <SelectContent>
                {pipelines?.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Distribution Rule */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Quem assume?
          </Label>
          <Select
            value={settings.distribution_rule}
            onValueChange={(v) => updateSetting("distribution_rule", v as FormDistributionRule)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISTRIBUTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Specific User Selection */}
        {settings.distribution_rule === "specific_user" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Responsável fixo</Label>
            <Select
              value={settings.target_user_id || ""}
              onValueChange={(v) => updateSetting("target_user_id", v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável..." />
              </SelectTrigger>
              <SelectContent>
                {salesReps?.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notify Manager Toggle */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="text-sm font-medium">Notificar gestor</Label>
              <p className="text-xs text-muted-foreground">
                {isTicketMode 
                  ? "Enviar alerta quando novo ticket chegar"
                  : "Enviar alerta quando novo lead chegar"
                }
              </p>
            </div>
          </div>
          <Switch
            checked={settings.notify_manager}
            onCheckedChange={(v) => updateSetting("notify_manager", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
