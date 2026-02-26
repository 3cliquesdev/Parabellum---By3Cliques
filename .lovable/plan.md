

# Fix: Contadores cortados na sidebar do Inbox

## Problema
A sidebar do Inbox tem largura fixa `w-56` (224px) que corta os badges de contagem, especialmente números grandes como "8090" (Encerradas). Os números ficam parcialmente visíveis.

## Solução
Duas mudanças simples:

### 1. `src/pages/Inbox.tsx` — Aumentar largura da sidebar
- Linha 553: mudar `w-56` para `w-60` (240px) — mais espaço para os badges

### 2. `src/components/inbox/InboxSidebar.tsx` — Garantir que badges não sejam cortados
- Linha 85-88: Adicionar `min-w-0 truncate` no container do label para que o texto do label encolha antes do badge
- Linha 89-99: Adicionar `shrink-0` no Badge para que nunca seja comprimido
- Garantir que o `overflow` do container pai não oculte os badges

### Mudanças específicas:

**Inbox.tsx linha 553:**
```
w-56 → w-60
```

**InboxSidebar.tsx linhas 85-88 (div do label):**
```tsx
<div className="flex items-center gap-2 min-w-0">
  {icon}
  <span className="truncate">{label}</span>
</div>
```

**InboxSidebar.tsx linha 89 (Badge):**
Adicionar `shrink-0` para o badge nunca ser cortado:
```tsx
<Badge 
  variant={isActive ? "default" : "secondary"} 
  className={cn(
    "min-w-6 justify-center shrink-0",
    ...
  )}
>
```

## Impacto
- Zero regressão: apenas CSS, sem mudança de lógica
- Melhora visual: todos os contadores ficam sempre visíveis
- Labels longos usam truncate em vez de empurrar o badge para fora

