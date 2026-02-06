
# Plano Ajustado: Suporte a Minutes/Hours/Days no Nó Delay com Shared Logic

## Arquitetura Proposta

Centralizar lógica de delay em arquivo compartilhado (`supabase/functions/_shared/delay.ts`) para evitar duplicação entre frontend e edge functions. Adicionar normalização robusta com fallbacks para backward compatibility.

## 1. Criar Arquivo Compartilhado: `supabase/functions/_shared/delay.ts`

Arquivo novo com 3 funções principais:

```typescript
/**
 * Converte delay (type + value) para segundos
 * @param delayType - 'minutes' | 'hours' | 'days'
 * @param delayValue - número inteiro positivo
 * @returns segundos (número)
 */
export function convertDelayToSeconds(delayType: string, delayValue: number): number {
  switch (delayType?.toLowerCase()) {
    case 'minutes':
      return delayValue * 60;
    case 'hours':
      return delayValue * 3600;
    case 'days':
      return delayValue * 86400;
    default:
      return 86400; // fallback: 1 day
  }
}

/**
 * Formata delay para exibição em UI
 * @returns string pluralizada (ex: "Aguardar 5 minutos")
 */
export function formatDelayDisplay(delayType: string, delayValue: number): string {
  const type = delayType?.toLowerCase() || 'days';
  const value = Math.max(1, Math.floor(delayValue));
  
  switch (type) {
    case 'minutes':
      return `Aguardar ${value} ${value === 1 ? 'minuto' : 'minutos'}`;
    case 'hours':
      return `Aguardar ${value} ${value === 1 ? 'hora' : 'horas'}`;
    case 'days':
      return `Aguardar ${value} ${value === 1 ? 'dia' : 'dias'}`;
    default:
      return 'Aguardar';
  }
}

/**
 * Normaliza dados de delay com fallback para backward compatibility
 * - Se não houver delay_type/delay_value e houver duration_days -> converte
 * - Clamp: min=1, max=365 dias (1 ano)
 * - Sempre retorna duration_days = (total_seconds / 86400) para compatibilidade
 */
export function normalizeDelayData(nodeData: any): {
  delay_type: 'minutes' | 'hours' | 'days';
  delay_value: number;
  duration_days: number;
} {
  // Prioridade: delay_type/value > duration_days > defaults
  let delayType = nodeData?.delay_type || 'days';
  let delayValue = nodeData?.delay_value ?? (nodeData?.duration_days || 1);
  
  // Validar tipo
  if (!['minutes', 'hours', 'days'].includes(delayType)) {
    delayType = 'days';
  }
  
  // Clamp value: min 1, max 365 dias
  const maxSeconds = 365 * 86400;
  const seconds = convertDelayToSeconds(delayType, delayValue);
  
  if (seconds > maxSeconds) {
    console.warn('[normalizeDelayData] Clamped delay to max (1 year)');
    delayValue = 365; // fallback para 365 dias
    delayType = 'days';
  } else if (seconds < 1) {
    delayValue = 1;
  }
  
  // Sempre calcular duration_days em float (para compatibilidade)
  const finalSeconds = convertDelayToSeconds(delayType, delayValue);
  const durationDays = finalSeconds / 86400;
  
  return {
    delay_type: delayType as 'minutes' | 'hours' | 'days',
    delay_value: Math.floor(delayValue),
    duration_days: durationDays,
  };
}
```

## 2. Atualizar Types em Frontend

**Arquivo: `src/components/playbook/DelayNode.tsx`**

```typescript
interface DelayNodeData {
  label: string;
  delay_type?: 'minutes' | 'hours' | 'days';
  delay_value?: number;
  duration_days?: number; // legacy fallback
}
```

## 3. PlaybookEditor.tsx - Criação de Nó Delay

**Linha ~111:** Atualizar data inicial

```typescript
...(type === "delay" && { 
  delay_type: 'days',
  delay_value: 1,
  duration_days: 1  // manter legacy
})
```

## 4. PlaybookEditor.tsx - Painel de Propriedades

**Linhas ~364-372:** Substituir input único por Select + Input

```typescript
{selectedNode.type === "delay" && (
  <div className="space-y-4">
    <div>
      <Label htmlFor="delay-type">Unidade de Tempo</Label>
      <Select 
        value={selectedNode.data.delay_type || 'days'}
        onValueChange={(value) => {
          // Ao mudar tipo, atualizar também duration_days
          const normalized = normalizeDelayData({
            delay_type: value,
            delay_value: selectedNode.data.delay_value || 1,
          });
          updateNodeData('delay_type', value);
          updateNodeData('delay_value', normalized.delay_value);
          updateNodeData('duration_days', normalized.duration_days);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="minutes">Minutos</SelectItem>
          <SelectItem value="hours">Horas</SelectItem>
          <SelectItem value="days">Dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
    
    <div>
      <Label htmlFor="delay-value">Quantidade</Label>
      <Input
        id="delay-value"
        type="number"
        min="1"
        max="365"
        value={selectedNode.data.delay_value || 1}
        onChange={(e) => {
          const value = parseInt(e.target.value) || 1;
          const normalized = normalizeDelayData({
            delay_type: selectedNode.data.delay_type || 'days',
            delay_value: value,
          });
          updateNodeData('delay_value', value);
          updateNodeData('duration_days', normalized.duration_days);
        }}
      />
    </div>
  </div>
)}
```

## 5. DelayNode.tsx - Subtitle Dinâmica

Importar `formatDelayDisplay` e usar normalizeDelayData:

```typescript
import { formatDelayDisplay, normalizeDelayData } from "@/lib/utils";

export const DelayNode = memo(({ data, selected }: NodeProps<DelayNodeData>) => {
  const normalized = normalizeDelayData(data);
  const subtitle = formatDelayDisplay(normalized.delay_type, normalized.delay_value);

  return (
    <WorkflowNodeWrapper
      type="delay"
      icon={Clock}
      title={data.label}
      subtitle={subtitle}
      selected={selected}
    />
  );
});
```

## 6. SimulatorStepRenderer.tsx - Linha ~114-134

Usar funções compartilhadas:

```typescript
if (node.type === "delay") {
  const normalized = normalizeDelayData(node.data);
  const seconds = convertDelayToSeconds(normalized.delay_type, normalized.delay_value);
  const displayText = formatDelayDisplay(normalized.delay_type, normalized.delay_value);
  
  return (
    <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Clock className="h-8 w-8 text-amber-600" />
        <div>
          <h3 className="font-semibold text-lg">⏳ {displayText}...</h3>
          <p className="text-sm text-muted-foreground">
            ({seconds} segundos - Em produção, o próximo passo executaria após este período.)
          </p>
        </div>
      </div>

      <Button onClick={() => onComplete()} className="gap-2 bg-amber-600 hover:bg-amber-700">
        <FastForward className="h-4 w-4" />
        ⏩ Avançar Tempo (Pular)
      </Button>
    </Card>
  );
}
```

## 7. Edge Function: `process-playbook-queue/index.ts` - Linhas ~359-398

Usar arquivo compartilhado para calcular delay:

```typescript
async function handleDelayNode(
  item: QueueItem,
  execution: PlaybookExecution,
  supabaseAdmin: any
): Promise<{ success: boolean; delay_days?: number }> {
  console.log(`Executing delay node: ${item.node_id}`);
  
  // Import e usar delay.ts
  const { convertDelayToSeconds, normalizeDelayData } = await import('../_shared/delay.ts');
  
  const normalized = normalizeDelayData(item.node_data);
  const seconds = convertDelayToSeconds(normalized.delay_type, normalized.delay_value);
  const nextExecutionTime = new Date(Date.now() + seconds * 1000);

  console.log(`Delay: ${normalized.delay_value}${normalized.delay_type}, next execution: ${nextExecutionTime.toISOString()}`);

  // Resto da lógica igual (queue next node com scheduled_for atualizado)
  // ...
  
  return { success: true, delay_days: normalized.duration_days };
}
```

## 8. Importações Necessárias

**Em arquivos frontend que usarem helpers:**

```typescript
import { formatDelayDisplay, convertDelayToSeconds, normalizeDelayData } from "@/lib/utils";
```

**Em edge functions:**

```typescript
// Importar do arquivo _shared
import { convertDelayToSeconds, normalizeDelayData, formatDelayDisplay } from '../_shared/delay.ts';
```

## Sequência de Implementação

1. ✅ Criar `supabase/functions/_shared/delay.ts`
2. ✅ Adicionar helpers em `src/lib/utils.ts` (espelhando _shared para frontend usar)
3. ✅ Atualizar interface `DelayNodeData` em `src/components/playbook/DelayNode.tsx`
4. ✅ Atualizar `PlaybookEditor.tsx` - inicialização (linha 111)
5. ✅ Atualizar `PlaybookEditor.tsx` - painel propriedades (linhas 364-372)
6. ✅ Atualizar `DelayNode.tsx` - renderização
7. ✅ Atualizar `SimulatorStepRenderer.tsx` - exibição
8. ✅ Atualizar `process-playbook-queue/index.ts` - handler delay

## Garantias Enterprise

| # | Garantia | Implementação |
|---|----------|---------------|
| 1 | Backward Compatibility | `normalizeDelayData` converte antigos `duration_days` automaticamente |
| 2 | Single Source of Truth | Lógica centralizada em `_shared/delay.ts` |
| 3 | Clamp Seguro | Min 1, Max 365 dias (1 ano) |
| 4 | Display Pluralizado | `formatDelayDisplay` trata singular/plural correto |
| 5 | Persistência Correta | `duration_days` sempre preenchido para compatibilidade |
| 6 | Sem Regressão | Playbooks antigos com só `duration_days` funcionam igual |

## Testes Obrigatórios (antes de aprovar)

| # | Cenário | Validação |
|---|---------|-----------|
| 1 | Criar delay 5 minutos | Exibe "Aguardar 5 minutos", scheduled_for = now + 300s |
| 2 | Criar delay 2 horas | Exibe "Aguardar 2 horas", scheduled_for = now + 7200s |
| 3 | Criar delay 3 dias | Exibe "Aguardar 3 dias", scheduled_for = now + 259200s |
| 4 | Alterar de minutos → horas | Salva corretamente, UI atualiza |
| 5 | Playbook antigo com `duration_days: 1` (sem delay_type) | Carrega OK, exibe "Aguardar 1 dia" |
| 6 | Simulator mostra todos os tipos | Exibe com segundos totais corretos |
| 7 | Executar playbook com delay minuto | Edge function persiste scheduled_for corretamente |
| 8 | Clamp max 365 dias | Valores > 1 ano são truncados para 365 dias |

