import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDataCatalog } from "@/hooks/useDataCatalog";
import { useReportQuery } from "@/hooks/useReportQuery";
import { useReportDefinitions } from "@/hooks/useReportDefinitions";
import { EntitySelector } from "@/components/report-builder/EntitySelector";
import { FieldPicker } from "@/components/report-builder/FieldPicker";
import { FilterBuilder, type FilterItem } from "@/components/report-builder/FilterBuilder";
import { GroupingConfig, type GroupingItem } from "@/components/report-builder/GroupingConfig";
import { MetricConfig, type MetricItem } from "@/components/report-builder/MetricConfig";
import { ReportPreview } from "@/components/report-builder/ReportPreview";
import { SaveReportDialog } from "@/components/report-builder/SaveReportDialog";
import { ReportBuilderToolbar } from "@/components/report-builder/ReportBuilderToolbar";

const ReportBuilder = () => {
  const [entity, setEntity] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [groupings, setGroupings] = useState<GroupingItem[]>([]);
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);

  const { entities, getFieldsForEntity } = useDataCatalog();
  const fieldsQuery = getFieldsForEntity(entity);
  const reportQuery = useReportQuery();
  const { save } = useReportDefinitions();

  const catalogFields = fieldsQuery.data || [];

  const handleEntityChange = (e: string) => {
    setEntity(e);
    setSelectedFields([]);
    setFilters([]);
    setGroupings([]);
    setMetrics([]);
  };

  const buildDefinition = () => ({
    base_entity: entity!,
    fields: selectedFields.map((fn) => ({ entity: entity!, field_name: fn })),
    metrics,
    filters,
    groupings,
  });

  const handlePreview = () => {
    if (!entity) return;
    reportQuery.execute({ definition_inline: buildDefinition(), limit: 100 });
  };

  const handleSave = (name: string, description: string) => {
    if (!entity) return;
    save.mutate({
      name,
      description,
      ...buildDefinition(),
    });
    setSaveOpen(false);
  };

  const canPreview = !!entity && (selectedFields.length > 0 || metrics.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Report Builder</h1>
        <p className="text-muted-foreground">Crie relatórios personalizados a partir dos dados do sistema</p>
      </div>

      <div className="flex items-center justify-end">
        <ReportBuilderToolbar
          onPreview={handlePreview}
          onSave={() => setSaveOpen(true)}
          previewDisabled={!canPreview}
          saveDisabled={!canPreview}
          loading={reportQuery.loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Entidade</CardTitle>
          </CardHeader>
          <CardContent>
            <EntitySelector
              entities={entities.data || []}
              value={entity}
              onChange={handleEntityChange}
              loading={entities.isLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Campos</CardTitle>
          </CardHeader>
          <CardContent>
            {entity ? (
              <FieldPicker
                fields={catalogFields}
                selected={selectedFields}
                onChange={setSelectedFields}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma entidade primeiro</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            {entity ? (
              <FilterBuilder
                entity={entity}
                fields={catalogFields}
                filters={filters}
                onChange={setFilters}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma entidade primeiro</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Agrupamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {entity ? (
              <GroupingConfig
                entity={entity}
                fields={catalogFields}
                groupings={groupings}
                onChange={setGroupings}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma entidade primeiro</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">5. Métricas</CardTitle>
          </CardHeader>
          <CardContent>
            {entity ? (
              <MetricConfig
                entity={entity}
                fields={catalogFields}
                metrics={metrics}
                onChange={setMetrics}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma entidade primeiro</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportPreview
            rows={reportQuery.result?.rows || []}
            loading={reportQuery.loading}
            error={reportQuery.error}
            hasMore={reportQuery.result?.has_more}
          />
        </CardContent>
      </Card>

      <SaveReportDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onSave={handleSave}
        saving={save.isPending}
      />
    </div>
  );
};

export default ReportBuilder;
