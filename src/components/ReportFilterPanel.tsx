import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useGenerateReport } from "@/hooks/useGenerateReport";
import { useDepartments } from "@/hooks/useDepartments";
import { useUsers } from "@/hooks/useUsers";
import { usePipelines } from "@/hooks/usePipelines";
interface ReportFilterPanelProps {
  report: {
    id: string;
    name: string;
    description: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReportFilterPanel({ report, open, onOpenChange }: ReportFilterPanelProps) {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [reportFormat, setReportFormat] = useState<'csv' | 'pdf'>('csv');
  const [departmentId, setDepartmentId] = useState<string>('__all__');
  const [agentId, setAgentId] = useState<string>('__all__');
  const [pipelineId, setPipelineId] = useState<string>('__all__');
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const { data: departments } = useDepartments();
  const { data: users } = useUsers();
  const { data: pipelines } = usePipelines();
  const generateReport = useGenerateReport();

  const handleDownload = () => {
    generateReport.mutate({
      report_type: report.id,
      filters: {
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        departmentId: departmentId === '__all__' ? undefined : departmentId,
        agentId: agentId === '__all__' ? undefined : agentId,
        pipelineId: pipelineId === '__all__' ? undefined : pipelineId,
      },
      format: reportFormat,
    });
  };

  const quickRanges = [
    { label: 'Hoje', days: 0 },
    { label: 'Ontem', days: 1 },
    { label: 'Últimos 7 dias', days: 7 },
    { label: 'Últimos 30 dias', days: 30 },
    { label: 'Mês Passado', days: -1 }, // Special case
  ];

  const setQuickRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    
    if (days === -1) {
      // Mês Passado
      from.setMonth(from.getMonth() - 1);
      from.setDate(1);
      to.setDate(0);
    } else {
      from.setDate(from.getDate() - days);
    }
    
    setDateRange({ from, to });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{report.name}</SheetTitle>
          <SheetDescription>{report.description}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Período */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">📅 Período</Label>
            <div className="flex flex-wrap gap-2">
              {quickRanges.map((range) => (
                <Button
                  key={range.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickRange(range.days)}
                >
                  {range.label}
                </Button>
              ))}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>De</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, "PPP", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Até</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, "PPP", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Formato */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">📄 Formato</Label>
            <RadioGroup value={reportFormat} onValueChange={(v) => setReportFormat(v as 'csv' | 'pdf')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal cursor-pointer">
                  CSV (Excel) - Melhor para análise de dados
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="font-normal cursor-pointer">
                  PDF - Melhor para apresentações
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Filtros Específicos */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">🔍 Filtros Específicos</Label>
            
            {(report.id.includes('ticket') || report.id.includes('conversation')) && (
              <div>
                <Label>Departamento (opcional)</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(report.id.includes('agent') || report.id.includes('ticket')) && (
              <div>
                <Label>Agente (opcional)</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os agentes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {report.id === 'deals_won_lost' && (
              <div>
                <Label>Funil (opcional)</Label>
                <Select value={pipelineId} onValueChange={setPipelineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os funis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os funis</SelectItem>
                    {pipelines?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Agendamento */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">⏰ Agendamento</Label>
              <Switch checked={enableSchedule} onCheckedChange={setEnableSchedule} />
            </div>
            
            {enableSchedule && (
              <div className="space-y-3 pt-2">
                <div>
                  <Label>Frequência</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  ℹ️ Você receberá este relatório automaticamente por e-mail
                </p>
              </div>
            )}
          </div>

          {/* Botão Download */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleDownload}
            disabled={generateReport.isPending}
          >
            {generateReport.isPending ? (
              <>Gerando...</>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Baixar Relatório
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
