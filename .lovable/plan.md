

## Plano de Correção: Filtros de Tickets Somem ao Voltar (Bug no sessionStorage)

### Problema Identificado

A implementação atual do `sessionStorage` está com um bug sutil que impede a restauração correta dos filtros.

### Diagnóstico Técnico

**Causa Raiz:** O `useCallback` com dependência vazia `[]` (linha 83) faz com que o `searchParams` seja capturado no momento da criação do callback, não o valor atual durante a execução.

```typescript
// PROBLEMA: searchParams é capturado no closure, não é reativo
const getInitialFilters = useCallback(() => {
  const filterFromUrl = searchParams.get('filter'); // <- valor "congelado"
  // ...
}, []); // <- dependência vazia = não atualiza
```

**Fluxo do Bug:**

```text
1. Usuario aplica filtro "financeiro" -> URL: ?filters={category:["financeiro"]}
2. Clica no ticket -> saveFiltersToSession() salva -> navega para /support/123
3. Clica "Voltar" -> navega para /support (SEM query params)
4. Support.tsx REMONTA:
   - getInitialFilters() executa
   - searchParams.get('filter') retorna null (correto)
   - sessionStorage.getItem() deveria retornar os filtros salvos
   - MAS: O sessionStorage pode estar sendo lido corretamente, 
     porem o useEffect da linha 110-126 RESETA a URL para vazia
     porque os states ainda nao foram atualizados!
```

**O verdadeiro problema:** A ordem de execução do React:
1. `useMemo(getInitialFilters)` executa e retorna valores do sessionStorage
2. `useState(initialFilters.xxx)` inicializa com valores corretos
3. **MAS** o `useEffect` na linha 110-126 roda DEPOIS e sincroniza baseado nos states
4. Como os states já foram atualizados, deveria funcionar...

Após análise mais profunda, o problema está no **timing da leitura do sessionStorage**. O `searchParams` na **primeira renderização** quando voltamos pode conter valores antigos do cache do React Router.

### Solução Proposta

Mudar a abordagem: ao invés de usar `useMemo` para inicialização, usar um `useEffect` separado que restaura os filtros **após** a montagem, com uma flag para evitar loop.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Support.tsx` | Refatorar restauração com useEffect + flag de controle |

---

### Implementação Detalhada

#### Mudança Principal: Restauração via useEffect

```typescript
// REMOVER: useMemo para inicialização
// const initialFilters = useMemo(() => getInitialFilters(), [getInitialFilters]);

// NOVO: Inicializar com defaults ou URL (sem sessionStorage aqui)
const getInitialFromUrl = () => {
  const filterFromUrl = searchParams.get('filter') as SidebarFilter;
  const filtersFromUrl = searchParams.get('filters');
  
  if (filterFromUrl || filtersFromUrl) {
    let advancedFilters = defaultTicketFilters;
    if (filtersFromUrl) {
      try {
        advancedFilters = { ...defaultTicketFilters, ...JSON.parse(filtersFromUrl) };
      } catch {
        advancedFilters = defaultTicketFilters;
      }
    }
    return {
      sidebarFilter: filterFromUrl || 'all',
      advancedFilters,
      fromUrl: true,
    };
  }
  return {
    sidebarFilter: 'all' as SidebarFilter,
    advancedFilters: defaultTicketFilters,
    fromUrl: false,
  };
};

const initialFromUrl = getInitialFromUrl();

// States iniciam com valores da URL ou defaults
const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(initialFromUrl.sidebarFilter);
const [advancedFilters, setAdvancedFilters] = useState<TicketFilters>(initialFromUrl.advancedFilters);
const [searchTerm, setSearchTerm] = useState('');
const [currentPage, setCurrentPage] = useState(1);

// Flag para evitar restaurar múltiplas vezes
const [restoredFromSession, setRestoredFromSession] = useState(false);

// NOVO: useEffect para restaurar do sessionStorage APENAS se não veio da URL
useEffect(() => {
  // Só executar uma vez e apenas se não tinha filtros na URL
  if (restoredFromSession || initialFromUrl.fromUrl) return;
  
  const savedFilters = sessionStorage.getItem(TICKET_FILTERS_STORAGE_KEY);
  if (savedFilters) {
    try {
      const parsed = JSON.parse(savedFilters);
      setSidebarFilter(parsed.sidebarFilter || 'all');
      setAdvancedFilters(parsed.advancedFilters || defaultTicketFilters);
      setSearchTerm(parsed.searchTerm || '');
      setCurrentPage(parsed.currentPage || 1);
      sessionStorage.removeItem(TICKET_FILTERS_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to restore ticket filters:', e);
      sessionStorage.removeItem(TICKET_FILTERS_STORAGE_KEY);
    }
  }
  setRestoredFromSession(true);
}, [restoredFromSession, initialFromUrl.fromUrl]);
```

#### Ajuste no useEffect de Sincronização com URL

```typescript
// Modificar para não rodar antes da restauração
useEffect(() => {
  // Não sincronizar URL até ter restaurado do sessionStorage
  if (!restoredFromSession && !initialFromUrl.fromUrl) return;
  
  const params = new URLSearchParams();
  
  if (sidebarFilter !== 'all') {
    params.set('filter', sidebarFilter);
  }
  
  const hasAdvancedFilters = JSON.stringify(advancedFilters) !== JSON.stringify(defaultTicketFilters);
  if (hasAdvancedFilters) {
    params.set('filters', JSON.stringify(advancedFilters));
  }
  
  setSearchParams(params, { replace: true });
}, [sidebarFilter, advancedFilters, setSearchParams, restoredFromSession, initialFromUrl.fromUrl]);
```

---

### Benefícios da Correção

- Filtros são restaurados corretamente após voltar do ticket
- Evita race condition entre restauração e sincronização com URL
- Flag de controle impede loops infinitos
- Compatível com navegação por URL direta (deep links)
- Limpa sessionStorage após restauração para evitar efeitos colaterais

---

### Seção Técnica

**Fluxo corrigido:**

```text
[Usuário com filtro "financeiro"]
         |
         | (click em ticket)
         v
  saveFiltersToSession() -> sessionStorage = {sidebarFilter, advancedFilters, ...}
         |
         v
  navigate('/support/123')
         |
         | (click em Voltar)
         v
  navigate('/support')
         |
         v
  Support.tsx monta:
    1. getInitialFromUrl() -> sem filtros na URL -> fromUrl: false
    2. useState com defaults
    3. restoredFromSession = false
         |
         v
  useEffect de restauração:
    - restoredFromSession = false ✓
    - fromUrl = false ✓
    - sessionStorage.getItem() -> retorna filtros salvos
    - setSidebarFilter("all"), setAdvancedFilters({category:["financeiro"]})
    - sessionStorage.removeItem()
    - setRestoredFromSession(true)
         |
         v
  useEffect de sync URL:
    - restoredFromSession = true ✓
    - Atualiza URL: ?filters={category:["financeiro"]}
         |
         v
  [Lista com filtros preservados!]
```

**Código principal da correção:**

```typescript
// src/pages/Support.tsx

const TICKET_FILTERS_STORAGE_KEY = 'ticket-filters-session';

// Ler apenas da URL na inicialização
const getInitialFromUrl = () => {
  const filterFromUrl = searchParams.get('filter') as SidebarFilter;
  const filtersFromUrl = searchParams.get('filters');
  
  if (filterFromUrl || filtersFromUrl) {
    let advancedFilters = defaultTicketFilters;
    if (filtersFromUrl) {
      try { advancedFilters = { ...defaultTicketFilters, ...JSON.parse(filtersFromUrl) }; } catch {}
    }
    return { sidebarFilter: filterFromUrl || 'all', advancedFilters, fromUrl: true };
  }
  return { sidebarFilter: 'all' as SidebarFilter, advancedFilters: defaultTicketFilters, fromUrl: false };
};

const initialFromUrl = getInitialFromUrl();
const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(initialFromUrl.sidebarFilter);
const [advancedFilters, setAdvancedFilters] = useState<TicketFilters>(initialFromUrl.advancedFilters);
const [searchTerm, setSearchTerm] = useState('');
const [currentPage, setCurrentPage] = useState(1);
const [restoredFromSession, setRestoredFromSession] = useState(initialFromUrl.fromUrl);

// Restaurar do sessionStorage (uma vez, se não veio da URL)
useEffect(() => {
  if (restoredFromSession) return;
  const saved = sessionStorage.getItem(TICKET_FILTERS_STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      setSidebarFilter(parsed.sidebarFilter || 'all');
      setAdvancedFilters(parsed.advancedFilters || defaultTicketFilters);
      setSearchTerm(parsed.searchTerm || '');
      setCurrentPage(parsed.currentPage || 1);
    } catch (e) { console.error('Failed to restore filters:', e); }
    sessionStorage.removeItem(TICKET_FILTERS_STORAGE_KEY);
  }
  setRestoredFromSession(true);
}, [restoredFromSession]);

// Sincronizar filtros para URL (só após restauração)
useEffect(() => {
  if (!restoredFromSession) return;
  const params = new URLSearchParams();
  if (sidebarFilter !== 'all') params.set('filter', sidebarFilter);
  if (JSON.stringify(advancedFilters) !== JSON.stringify(defaultTicketFilters)) {
    params.set('filters', JSON.stringify(advancedFilters));
  }
  setSearchParams(params, { replace: true });
}, [sidebarFilter, advancedFilters, setSearchParams, restoredFromSession]);
```

