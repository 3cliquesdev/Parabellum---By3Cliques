import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FormField, FormSchema, FormSettings, FormFieldType, createDefaultField, DEFAULT_FORM_SETTINGS } from "@/hooks/useForms";
import { FieldBlockPalette } from "./FieldBlockPalette";
import { SortableFieldCard } from "./SortableFieldCard";
import { FieldConfigPanel } from "./FieldConfigPanel";
import { FormSettingsPanel } from "./FormSettingsPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Layers, Eye } from "lucide-react";

interface FormBuilderV2Props {
  schema: FormSchema;
  onChange: (schema: FormSchema) => void;
  onPreview?: () => void;
}

export function FormBuilderV2({ schema, onChange, onPreview }: FormBuilderV2Props) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"fields" | "settings">("fields");

  const fields = schema.fields || [];
  const settings = schema.settings || DEFAULT_FORM_SETTINGS;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);

      const newFields = arrayMove(fields, oldIndex, newIndex);
      onChange({ ...schema, fields: newFields });
    }
  };

  const addField = (type: FormFieldType) => {
    const newField = createDefaultField(type);
    onChange({ ...schema, fields: [...fields, newField] });
    setSelectedFieldId(newField.id);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    const newFields = fields.map((f) =>
      f.id === fieldId ? { ...f, ...updates } : f
    );
    onChange({ ...schema, fields: newFields });
  };

  const deleteField = (fieldId: string) => {
    const newFields = fields.filter((f) => f.id !== fieldId);
    onChange({ ...schema, fields: newFields });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const duplicateField = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field) {
      const newField = { ...field, id: crypto.randomUUID() };
      const index = fields.findIndex((f) => f.id === fieldId);
      const newFields = [...fields];
      newFields.splice(index + 1, 0, newField);
      onChange({ ...schema, fields: newFields });
      setSelectedFieldId(newField.id);
    }
  };

  const updateSettings = (newSettings: Partial<FormSettings>) => {
    onChange({ ...schema, settings: { ...settings, ...newSettings } });
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] gap-4">
      {/* Sidebar Esquerda - Paleta de Blocos */}
      <div className="w-64 flex-shrink-0 border rounded-lg bg-card p-4 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="fields" className="gap-1">
              <Layers className="h-4 w-4" />
              Blocos
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1">
              <Settings className="h-4 w-4" />
              Design
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="mt-0">
            <FieldBlockPalette onAddField={addField} />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <FormSettingsPanel settings={settings} onChange={updateSettings} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Canvas Central - Lista de Campos */}
      <div className="flex-1 border rounded-lg bg-muted/30 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">
            {fields.length === 0 ? "Arraste blocos para começar" : `${fields.length} pergunta${fields.length !== 1 ? "s" : ""}`}
          </h3>
          {onPreview && (
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </Button>
          )}
        </div>

        {fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
            <Layers className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-center">
              Clique nos blocos à esquerda<br />para adicionar campos
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <SortableFieldCard
                    key={field.id}
                    field={field}
                    index={index}
                    isSelected={selectedFieldId === field.id}
                    onSelect={() => setSelectedFieldId(field.id)}
                    onDelete={() => deleteField(field.id)}
                    onDuplicate={() => duplicateField(field.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Sidebar Direita - Configuração do Campo */}
      <div className="w-80 flex-shrink-0 border rounded-lg bg-card p-4 overflow-y-auto">
        {selectedField ? (
          <FieldConfigPanel
            field={selectedField}
            allFields={fields}
            onChange={(updates) => updateField(selectedField.id, updates)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Settings className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm text-center">
              Selecione um campo<br />para configurar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
