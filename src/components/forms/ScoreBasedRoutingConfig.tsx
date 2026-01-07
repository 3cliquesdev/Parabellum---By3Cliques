import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Route, Snowflake, Thermometer, Flame, Play, Save } from "lucide-react";
import { useFormScoreRouting, ScoreRoutingConfig, ScoreRoutingRule } from "@/hooks/useFormScoreRouting";
import { useScoringRanges } from "@/hooks/useScoringConfig";
import { cn } from "@/lib/utils";

interface ScoreBasedRoutingConfigProps {
  formId: string | undefined;
  hasScoringFields: boolean;
}

const classificationConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  frio: {
    icon: <Snowflake className="h-4 w-4" />,
    label: "Frio",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
  },
  morno: {
    icon: <Thermometer className="h-4 w-4" />,
    label: "Morno",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 border-yellow-200",
  },
  quente: {
    icon: <Flame className="h-4 w-4" />,
    label: "Quente",
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
  },
};

export function ScoreBasedRoutingConfig({ formId, hasScoringFields }: ScoreBasedRoutingConfigProps) {
  const {
    routingConfig,
    isLoadingConfig,
    pipelines,
    isLoadingPipelines,
    playbooks,
    isLoadingPlaybooks,
    getPlaybookNodes,
    updateRoutingConfig,
  } = useFormScoreRouting(formId);

  const { data: scoringRanges = [] } = useScoringRanges();

  const [localConfig, setLocalConfig] = useState<ScoreRoutingConfig>({
    enabled: false,
    rules: [],
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local config from server data
  useEffect(() => {
    if (routingConfig) {
      setLocalConfig(routingConfig);
    } else if (scoringRanges.length > 0) {
      // Initialize rules from scoring ranges
      const initialRules: ScoreRoutingRule[] = scoringRanges.map((range) => ({
        classification: range.classification?.toLowerCase() || "unknown",
        min_score: range.min_score,
        max_score: range.max_score,
        pipeline_id: null,
        playbook_id: null,
        playbook_start_node_id: null,
      }));
      setLocalConfig({ enabled: false, rules: initialRules });
    }
    setHasChanges(false);
  }, [routingConfig, scoringRanges]);

  const handleToggleEnabled = (enabled: boolean) => {
    setLocalConfig((prev) => ({ ...prev, enabled }));
    setHasChanges(true);
  };

  const handleRuleChange = (
    classification: string,
    field: "pipeline_id" | "playbook_id" | "playbook_start_node_id",
    value: string | null
  ) => {
    setLocalConfig((prev) => ({
      ...prev,
      rules: prev.rules.map((rule) => {
        if (rule.classification === classification) {
          const updatedRule = { ...rule, [field]: value };
          // Clear playbook_start_node_id if playbook changes
          if (field === "playbook_id") {
            updatedRule.playbook_start_node_id = null;
          }
          return updatedRule;
        }
        return rule;
      }),
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateRoutingConfig.mutateAsync(localConfig);
    setHasChanges(false);
  };

  if (!hasScoringFields) {
    return null;
  }

  if (isLoadingConfig || isLoadingPipelines || isLoadingPlaybooks) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg text-purple-900">Roteamento Inteligente por Score</CardTitle>
          </div>
          <Switch checked={localConfig.enabled} onCheckedChange={handleToggleEnabled} />
        </div>
        <CardDescription className="text-purple-700">
          Direcione leads automaticamente para pipelines e playbooks diferentes baseado na pontuação de qualificação
        </CardDescription>
      </CardHeader>

      {localConfig.enabled && (
        <CardContent className="space-y-4">
          {localConfig.rules.map((rule) => {
            const config = classificationConfig[rule.classification] || classificationConfig.morno;
            const playbookNodes = rule.playbook_id ? getPlaybookNodes(rule.playbook_id) : [];

            return (
              <div key={rule.classification} className={cn("rounded-lg border p-4 space-y-3", config.bgColor)}>
                <div className="flex items-center gap-2">
                  <span className={config.color}>{config.icon}</span>
                  <span className={cn("font-semibold uppercase text-sm", config.color)}>{config.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({rule.min_score} - {rule.max_score ?? "∞"} pts)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Pipeline Select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Pipeline de Destino</Label>
                    <Select
                      value={rule.pipeline_id || "none"}
                      onValueChange={(v) => handleRuleChange(rule.classification, "pipeline_id", v === "none" ? null : v)}
                    >
                      <SelectTrigger className="bg-background text-foreground">
                        <SelectValue placeholder="Selecionar pipeline" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] bg-popover"  sideOffset={5}>
                        <SelectItem value="none">Usar padrão do formulário</SelectItem>
                        {pipelines.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Playbook Select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Playbook a Executar</Label>
                    <Select
                      value={rule.playbook_id || "none"}
                      onValueChange={(v) => handleRuleChange(rule.classification, "playbook_id", v === "none" ? null : v)}
                    >
                      <SelectTrigger className="bg-background text-foreground">
                        <SelectValue placeholder="Selecionar playbook" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] bg-popover" sideOffset={5}>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {playbooks.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Playbook Start Node Select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      Iniciar no Nó
                    </Label>
                    <Select
                      value={rule.playbook_start_node_id || "first"}
                      onValueChange={(v) =>
                        handleRuleChange(rule.classification, "playbook_start_node_id", v === "first" ? null : v)
                      }
                      disabled={!rule.playbook_id}
                    >
                      <SelectTrigger className="bg-background text-foreground">
                        <SelectValue placeholder="Primeiro nó" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] bg-popover" sideOffset={5}>
                        <SelectItem value="first">Primeiro nó</SelectItem>
                        {playbookNodes.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.label} ({node.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}

          {hasChanges && (
            <Button onClick={handleSave} disabled={updateRoutingConfig.isPending} className="w-full">
              {updateRoutingConfig.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configuração de Roteamento
                </>
              )}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
