import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Clock, Calendar, Trash2, Save, Settings, MessageSquareText, AlertTriangle, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTags } from "@/hooks/useTags";
import { useBusinessMessages, useUpdateBusinessMessage } from "@/hooks/useBusinessMessages";
import { useAfterHoursKeepOpen } from "@/hooks/useAfterHoursKeepOpen";
import { 
  useSLAPolicies, 
  useCreateSLAPolicy, 
  useUpdateSLAPolicy, 
  useDeleteSLAPolicy,
  SLAPolicyInput 
} from "@/hooks/useSLAPolicies";
import { 
  useBusinessHolidays, 
  useCreateBusinessHoliday, 
  useDeleteBusinessHoliday,
  useBusinessHoursConfig,
  useUpdateBusinessHoursConfig,
  getDayName,
  formatTime,
  BusinessHolidayInput
} from "@/hooks/useBusinessHolidays";
import { useTicketCategories } from "@/hooks/useTicketCategories";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIME_UNITS = [
  { value: 'hours', label: 'Horas' },
  { value: 'business_hours', label: 'Horas Úteis' },
  { value: 'business_days', label: 'Dias Úteis' },
];

const PRIORITIES = [
  { value: 'all', label: 'Todas as Prioridades' },
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export default function SLASettings() {
  const navigate = useNavigate();
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  
  // Form states
  const [newPolicy, setNewPolicy] = useState<SLAPolicyInput>({
    category_id: null,
    priority: null,
    response_time_value: 1,
    response_time_unit: 'hours',
    resolution_time_value: 24,
    resolution_time_unit: 'hours',
    is_active: true,
  });
  
  const [newHoliday, setNewHoliday] = useState<BusinessHolidayInput>({
    date: '',
    description: '',
    is_recurring: false,
  });

  // Queries
  const { data: policies = [], isLoading: loadingPolicies } = useSLAPolicies();
  const { data: holidays = [], isLoading: loadingHolidays } = useBusinessHolidays();
  const { data: businessHours = [], isLoading: loadingHours } = useBusinessHoursConfig();
  const { data: categories = [] } = useTicketCategories();

  // Mutations
  const createPolicy = useCreateSLAPolicy();
  const updatePolicy = useUpdateSLAPolicy();
  const deletePolicy = useDeleteSLAPolicy();
  const createHoliday = useCreateBusinessHoliday();
  const deleteHoliday = useDeleteBusinessHoliday();
  const updateBusinessHours = useUpdateBusinessHoursConfig();

  const handleCreatePolicy = async () => {
    await createPolicy.mutateAsync(newPolicy);
    setIsAddingPolicy(false);
    setNewPolicy({
      category_id: null,
      priority: null,
      response_time_value: 1,
      response_time_unit: 'hours',
      resolution_time_value: 24,
      resolution_time_unit: 'hours',
      is_active: true,
    });
  };

  const handleCreateHoliday = async () => {
    await createHoliday.mutateAsync(newHoliday);
    setIsAddingHoliday(false);
    setNewHoliday({
      date: '',
      description: '',
      is_recurring: false,
    });
  };

  const formatTimeUnit = (value: number, unit: string) => {
    const unitLabels: Record<string, string> = {
      hours: value === 1 ? 'hora' : 'horas',
      business_hours: value === 1 ? 'hora útil' : 'horas úteis',
      business_days: value === 1 ? 'dia útil' : 'dias úteis',
    };
    return `${value} ${unitLabels[unit] || unit}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Configurações de SLA</h1>
              <p className="text-sm text-muted-foreground">
                Configure políticas de tempo de resposta e resolução por categoria
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="policies" className="space-y-6">
          <TabsList>
            <TabsTrigger value="policies" className="gap-2">
              <Clock className="h-4 w-4" />
              Políticas de SLA
            </TabsTrigger>
            <TabsTrigger value="holidays" className="gap-2">
              <Calendar className="h-4 w-4" />
              Feriados
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-2">
              <Settings className="h-4 w-4" />
              Horário Comercial
            </TabsTrigger>
          </TabsList>

          {/* Políticas de SLA */}
          <TabsContent value="policies">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Políticas por Categoria</CardTitle>
                    <CardDescription>
                      Defina tempos de resposta e resolução para cada categoria de ticket
                    </CardDescription>
                  </div>
                  <Dialog open={isAddingPolicy} onOpenChange={setIsAddingPolicy}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Política
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova Política de SLA</DialogTitle>
                        <DialogDescription>
                          Configure os tempos para uma categoria específica
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Categoria</Label>
                          <Select
                            value={newPolicy.category_id || ''}
                            onValueChange={(v) => setNewPolicy({ ...newPolicy, category_id: v || null })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Prioridade</Label>
                          <Select
                            value={newPolicy.priority || 'all'}
                            onValueChange={(v) => setNewPolicy({ ...newPolicy, priority: v === 'all' ? null : v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITIES.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tempo de Resposta</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newPolicy.response_time_value}
                              onChange={(e) => setNewPolicy({ ...newPolicy, response_time_value: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Select
                              value={newPolicy.response_time_unit}
                              onValueChange={(v: any) => setNewPolicy({ ...newPolicy, response_time_unit: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_UNITS.map((u) => (
                                  <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Tempo de Resolução</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newPolicy.resolution_time_value}
                              onChange={(e) => setNewPolicy({ ...newPolicy, resolution_time_value: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Select
                              value={newPolicy.resolution_time_unit}
                              onValueChange={(v: any) => setNewPolicy({ ...newPolicy, resolution_time_unit: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_UNITS.map((u) => (
                                  <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingPolicy(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreatePolicy} disabled={!newPolicy.category_id || createPolicy.isPending}>
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPolicies ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : policies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma política configurada. Adicione uma nova política.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Tempo Resposta</TableHead>
                        <TableHead>Tempo Resolução</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((policy) => (
                        <TableRow key={policy.id}>
                          <TableCell className="font-medium">
                            {policy.category?.name || 'Sem categoria'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {policy.priority 
                                ? PRIORITIES.find(p => p.value === policy.priority)?.label 
                                : 'Todas'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatTimeUnit(policy.response_time_value, policy.response_time_unit)}
                          </TableCell>
                          <TableCell>
                            {formatTimeUnit(policy.resolution_time_value, policy.resolution_time_unit)}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={policy.is_active}
                              onCheckedChange={(checked) => 
                                updatePolicy.mutate({ id: policy.id, ...policy, is_active: checked })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deletePolicy.mutate(policy.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feriados */}
          <TabsContent value="holidays">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Feriados</CardTitle>
                    <CardDescription>
                      Feriados são excluídos do cálculo de dias úteis
                    </CardDescription>
                  </div>
                  <Dialog open={isAddingHoliday} onOpenChange={setIsAddingHoliday}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Feriado
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Feriado</DialogTitle>
                        <DialogDescription>
                          Adicione um feriado ao calendário
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <Input
                            type="date"
                            value={newHoliday.date}
                            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Input
                            placeholder="Ex: Natal, Ano Novo..."
                            value={newHoliday.description}
                            onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            id="recurring"
                            checked={newHoliday.is_recurring}
                            onCheckedChange={(checked) => setNewHoliday({ ...newHoliday, is_recurring: checked })}
                          />
                          <Label htmlFor="recurring">Feriado recorrente (repete todo ano)</Label>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingHoliday(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleCreateHoliday} 
                          disabled={!newHoliday.date || !newHoliday.description || createHoliday.isPending}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHolidays ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : holidays.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum feriado cadastrado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.map((holiday) => (
                        <TableRow key={holiday.id}>
                          <TableCell className="font-medium">
                            {format(new Date(holiday.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{holiday.description}</TableCell>
                          <TableCell>
                            <Badge variant={holiday.is_recurring ? 'default' : 'secondary'}>
                              {holiday.is_recurring ? 'Recorrente' : 'Único'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteHoliday.mutate(holiday.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Horário Comercial */}
          <TabsContent value="hours">
            <Card>
              <CardHeader>
                <CardTitle>Horário Comercial</CardTitle>
                <CardDescription>
                  Configure os dias e horários de funcionamento para cálculo de SLA
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHours ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dia</TableHead>
                        <TableHead>Dia Útil</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businessHours.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell className="font-medium">
                            {getDayName(config.day_of_week)}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={config.is_working_day}
                              onCheckedChange={(checked) => 
                                updateBusinessHours.mutate({ id: config.id, is_working_day: checked })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <input
                              type="time"
                              value={formatTime(config.start_time)}
                              onChange={(e) => 
                                updateBusinessHours.mutate({ id: config.id, start_time: e.target.value })
                              }
                              className="flex h-10 w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!config.is_working_day}
                            />
                          </TableCell>
                          <TableCell>
                            <input
                              type="time"
                              value={formatTime(config.end_time)}
                              onChange={(e) => 
                                updateBusinessHours.mutate({ id: config.id, end_time: e.target.value })
                              }
                              className="flex h-10 w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!config.is_working_day}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
              </Table>
                )}
              </CardContent>
            </Card>

            {/* Mensagens Configuráveis */}
            <BusinessMessagesSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function BusinessMessagesSection() {
  const { data: messages = [], isLoading } = useBusinessMessages();
  const { data: allTags = [] } = useTags();
  const updateMessage = useUpdateBusinessMessage();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagInitialized, setTagInitialized] = useState(false);

  const defaults: Record<string, string> = {
    after_hours_handoff: "Nosso atendimento humano funciona {schedule}. {next_open} um atendente poderá te ajudar. Enquanto isso, posso continuar tentando por aqui! 😊",
    business_hours_reopened: "☀️ Horário comercial iniciado. Um atendente será designado para continuar seu atendimento.",
  };

  useEffect(() => {
    if (messages.length > 0) {
      const initial: Record<string, string> = {};
      messages.forEach((m) => { initial[m.id] = m.message_template; });
      setDrafts(initial);
      if (!tagInitialized) {
        const afterHoursMsg = messages.find(m => m.message_key === 'after_hours_handoff');
        if (afterHoursMsg) {
          setSelectedTagId(afterHoursMsg.after_hours_tag_id || null);
        }
        setTagInitialized(true);
      }
    }
  }, [messages, tagInitialized]);

  const handleSave = (id: string, messageKey?: string) => {
    const template = drafts[id];
    if (template !== undefined) {
      const mutationData: { id: string; message_template: string; after_hours_tag_id?: string | null } = { id, message_template: template };
      if (messageKey === 'after_hours_handoff') {
        mutationData.after_hours_tag_id = selectedTagId || null;
      }
      updateMessage.mutate(mutationData);
    }
  };

  const handleRestore = (msg: { id: string; message_key: string }) => {
    const defaultVal = defaults[msg.message_key];
    if (defaultVal) {
      setDrafts((prev) => ({ ...prev, [msg.id]: defaultVal }));
    }
  };

  const labels: Record<string, { title: string; placeholderHint: string }> = {
    after_hours_handoff: {
      title: "Quando o cliente pede atendente fora do horário",
      placeholderHint: "Placeholders disponíveis: {schedule} (horário de funcionamento), {next_open} (próxima abertura)",
    },
    business_hours_reopened: {
      title: "Quando o horário comercial abre (redistribuição)",
      placeholderHint: "Esta mensagem não utiliza placeholders dinâmicos",
    },
  };

  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardContent className="py-8 text-center text-muted-foreground">Carregando...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5" />
          Mensagens de Fora do Horário
        </CardTitle>
        <CardDescription>
          Personalize as mensagens automáticas enviadas quando o atendimento humano não está disponível
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {messages.map((msg) => {
          const label = labels[msg.message_key] || { title: msg.message_key, placeholderHint: "" };
          const draft = drafts[msg.id] ?? msg.message_template;
          const isDirty = draft !== msg.message_template;
          const isEmpty = !draft.trim();
          const missingPlaceholders =
            msg.message_key === "after_hours_handoff" &&
            draft.trim() &&
            (!draft.includes("{schedule}") || !draft.includes("{next_open}"));

          return (
            <div key={msg.id} className="space-y-2">
              <Label className="text-sm font-medium">{label.title}</Label>
              <p className="text-xs text-muted-foreground">{msg.description}</p>
              <Textarea
                value={draft}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [msg.id]: e.target.value }))}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground italic">{label.placeholderHint}</p>
              {missingPlaceholders && (
                <Alert variant="default" className="border-warning/50 bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-xs text-warning">
                    Atenção: os placeholders {"{{schedule}}"} e/ou {"{{next_open}}"} foram removidos. A mensagem pode ficar incompleta.
                  </AlertDescription>
                </Alert>
              )}
              {msg.message_key === 'after_hours_handoff' && (
                <div className="space-y-1.5 pt-2">
                  <Label className="text-sm font-medium">Tag aplicada ao encerrar fora do horário</Label>
                  <p className="text-xs text-muted-foreground">Selecione a tag que será adicionada automaticamente à conversa quando encerrada fora do horário comercial</p>
                  <Select
                    value={selectedTagId || "none"}
                    onValueChange={(val) => setSelectedTagId(val === "none" ? null : val)}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Selecione uma tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (sem tag)</SelectItem>
                      {allTags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color || 'hsl(var(--muted-foreground))' }} />
                            {tag.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSave(msg.id, msg.message_key)}
                  disabled={(!isDirty && selectedTagId === (messages.find(m => m.message_key === 'after_hours_handoff')?.after_hours_tag_id || null)) || isEmpty || updateMessage.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRestore(msg)}
                  disabled={draft === defaults[msg.message_key]}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restaurar Padrão
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
