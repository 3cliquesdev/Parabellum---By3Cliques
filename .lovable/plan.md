

# Fix: Pipeline padrão não persiste ao navegar

## Causa raiz

Quando o componente `Deals` remonta (volta do Inbox), a sequência é:
1. `user = null`, `profile = null` (auth ainda carregando)
2. `pipelines` carrega do cache do react-query (instantâneo)
3. O `useEffect` roda: `!user` é `true` → inicializa com o pipeline global padrão e marca `hasInitialized = true`
4. Auth termina de carregar: `user` e `profile` ficam disponíveis
5. Effect roda de novo mas `hasInitialized` já é `true` → **ignora o `default_pipeline_id` do usuário**

## Solução

### `src/pages/Deals.tsx` — Aguardar auth antes de inicializar

Extrair `loading` do `useAuth()` e adicionar na condição do `useEffect`:

```typescript
const { user, profile, refetchProfile, loading: authLoading } = useAuth();

useEffect(() => {
  if (!pipelines || pipelines.length === 0) return;
  if (authLoading) return; // Aguardar auth carregar antes de decidir

  const userDefault = profile?.default_pipeline_id;
  const userPipeline = userDefault ? pipelines.find(p => p.id === userDefault) : null;
  const globalDefault = pipelines.find(p => p.is_default);
  const chosen = userPipeline || globalDefault || pipelines[0];

  if (!hasInitialized.current) {
    setSelectedPipeline(chosen.id);
    hasInitialized.current = true;
  }
}, [pipelines, profile, user, authLoading]);
```

Mudança mínima: uma linha adicionada (`if (authLoading) return`) e `authLoading` nas dependências.

### Arquivo a alterar
- `src/pages/Deals.tsx` — adicionar guard `authLoading`

