import { useState, useEffect } from "react";
import { LucideIcon, Eye, EyeOff, Save, PlayCircle, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceIntegration } from "@/hooks/useWorkspaceIntegration";

export interface FieldDefinition {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "password";
  required?: boolean;
  description?: string;
}

interface IntegrationCardBaseProps {
  provider: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
  fields: FieldDefinition[];
  publicConfigFields?: FieldDefinition[];
  workspaceId?: string;
}

export function IntegrationCardBase({
  provider,
  title,
  description,
  icon: Icon,
  iconColor = "text-primary",
  fields,
  publicConfigFields = [],
  workspaceId,
}: IntegrationCardBaseProps) {
  const {
    integration,
    loading,
    saving,
    testing,
    fetchIntegration,
    saveIntegration,
    testIntegration,
  } = useWorkspaceIntegration(provider, workspaceId);

  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [publicConfig, setPublicConfig] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchIntegration();
  }, [fetchIntegration]);

  // Initialize public config from integration data
  useEffect(() => {
    if (integration?.public_config) {
      const config: Record<string, string> = {};
      for (const field of publicConfigFields) {
        const value = integration.public_config[field.key];
        if (value !== undefined) {
          config[field.key] = String(value);
        }
      }
      setPublicConfig(config);
    }
  }, [integration, publicConfigFields]);

  const handleSecretChange = (key: string, value: string) => {
    setSecrets(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handlePublicConfigChange = (key: string, value: string) => {
    setPublicConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    // Only include secrets that have been changed (non-empty)
    const secretsToSave: Record<string, string> = {};
    for (const field of fields) {
      if (secrets[field.key]) {
        secretsToSave[field.key] = secrets[field.key];
      }
    }

    await saveIntegration(secretsToSave, publicConfig);
    setSecrets({}); // Clear local secrets after save
    setHasChanges(false);
  };

  const handleTest = async () => {
    await testIntegration();
  };

  const getStatusBadge = () => {
    if (loading) {
      return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Carregando</Badge>;
    }

    switch (integration?.status) {
      case "active":
        return <Badge className="bg-primary/10 text-primary border-primary/20"><CheckCircle2 className="h-3 w-3 mr-1" />Configurado</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      case "inactive":
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Inativo</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Public Config Fields */}
        {publicConfigFields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`public-${field.key}`}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={`public-${field.key}`}
              type="text"
              placeholder={field.placeholder}
              value={publicConfig[field.key] || ""}
              onChange={(e) => handlePublicConfigChange(field.key, e.target.value)}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        ))}

        {/* Secret Fields */}
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="relative">
              <Input
                id={field.key}
                type={field.type === "password" && !showPasswords[field.key] ? "password" : "text"}
                placeholder={
                  integration?.secrets_masked?.[field.key] 
                    ? `Atual: ${integration.secrets_masked[field.key]}` 
                    : field.placeholder
                }
                value={secrets[field.key] || ""}
                onChange={(e) => handleSecretChange(field.key, e.target.value)}
                className="pr-10"
              />
              {field.type === "password" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility(field.key)}
                >
                  {showPasswords[field.key] ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              )}
            </div>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        ))}

        {/* Error Message */}
        {integration?.last_error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <strong>Último erro:</strong> {integration.last_error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex-1"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !integration?.is_configured}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Testar
          </Button>
        </div>

        {/* Last Check Info */}
        {integration?.last_checked_at && (
          <p className="text-xs text-muted-foreground text-center">
            Última verificação: {new Date(integration.last_checked_at).toLocaleString("pt-BR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
