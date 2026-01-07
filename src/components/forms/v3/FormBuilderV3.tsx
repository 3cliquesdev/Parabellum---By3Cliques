import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutGrid, 
  GitBranch, 
  Calculator, 
  Zap, 
  MessageSquare,
  Eye,
  Settings,
  Target
} from "lucide-react";
import type { FormField, FormSchema } from "@/hooks/useForms";
import { FormBuilderV2 } from "@/components/forms/FormBuilderV2";
import AdvancedConditionsBuilder from "./AdvancedConditionsBuilder";
import CalculationsPanel from "./CalculationsPanel";
import FormAutomationsPanel from "./FormAutomationsPanel";
import ConversationalModeSettings from "./ConversationalModeSettings";
import FormScoringPanel from "./FormScoringPanel";
import { useFormConditions } from "@/hooks/useFormConditions";
import { useFormAutomations } from "@/hooks/useFormAutomations";
import { useFormCalculations } from "@/hooks/useFormCalculations";

interface FormBuilderV3Props {
  formId: string;
  schema: FormSchema;
  settings?: any;
  onSchemaChange: (schema: FormSchema) => void;
  onSettingsChange?: (settings: any) => void;
  onPreview?: () => void;
}

export default function FormBuilderV3({ 
  formId, 
  schema, 
  settings = {},
  onSchemaChange, 
  onSettingsChange,
  onPreview 
}: FormBuilderV3Props) {
  const [activeTab, setActiveTab] = useState('builder');
  
  const { data: conditions = [] } = useFormConditions(formId);
  const { data: automations = [] } = useFormAutomations(formId);
  const { data: calculations = [] } = useFormCalculations(formId);
  
  const fields = schema.fields || [];
  const scoringFieldsCount = fields.filter(f => f.scoring?.enabled).length;
  
  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-2">
            <TabsList className="h-10">
              <TabsTrigger value="builder" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Campos</span>
                <Badge variant="secondary" className="ml-1">{fields.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="conditions" className="gap-2">
                <GitBranch className="h-4 w-4" />
                <span className="hidden sm:inline">Condições</span>
                {conditions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{conditions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="calculations" className="gap-2">
                <Calculator className="h-4 w-4" />
                <span className="hidden sm:inline">Cálculos</span>
                {calculations.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{calculations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="automations" className="gap-2">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Automações</span>
                {automations.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{automations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="scoring" className="gap-2">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Scoring</span>
                {scoringFieldsCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{scoringFieldsCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Modo</span>
              </TabsTrigger>
            </TabsList>
            
            {onPreview && (
              <Button variant="outline" size="sm" onClick={onPreview} className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {/* Fields Builder Tab */}
          <TabsContent value="builder" className="m-0 h-full">
            <FormBuilderV2
              schema={schema}
              onChange={onSchemaChange}
              onPreview={onPreview}
            />
          </TabsContent>
          
          {/* Conditions Tab */}
          <TabsContent value="conditions" className="m-0 p-4">
            <AdvancedConditionsBuilder formId={formId} fields={fields} />
          </TabsContent>
          
          {/* Calculations Tab */}
          <TabsContent value="calculations" className="m-0 p-4">
            <CalculationsPanel formId={formId} fields={fields} />
          </TabsContent>
          
          {/* Automations Tab */}
          <TabsContent value="automations" className="m-0 p-4">
            <FormAutomationsPanel formId={formId} fields={fields} />
          </TabsContent>
          
          {/* Scoring Tab */}
          <TabsContent value="scoring" className="m-0 p-4">
            <FormScoringPanel 
              schema={schema}
              onSchemaChange={onSchemaChange}
              formId={formId}
            />
          </TabsContent>
          
          {/* Conversational Mode Settings Tab */}
          <TabsContent value="settings" className="m-0 p-4">
            <ConversationalModeSettings 
              settings={settings}
              onUpdate={(newSettings) => onSettingsChange?.(newSettings)}
            />
          </TabsContent>
        </div>
      </Tabs>
      
      {/* Status Bar */}
      <div className="border-t bg-muted/30 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{fields.length} campos</span>
          <span>{conditions.length} condições</span>
          <span>{calculations.length} cálculos</span>
          <span>{automations.filter(a => a.is_active).length}/{automations.length} automações</span>
          <span>{scoringFieldsCount} scoring</span>
        </div>
        <div className="flex items-center gap-2">
          {settings.conversational_enabled && (
            <Badge variant="outline" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              Conversacional
            </Badge>
          )}
          {settings.ai_suggestions_enabled && (
            <Badge variant="outline" className="gap-1">
              <Zap className="h-3 w-3" />
              IA Ativa
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
