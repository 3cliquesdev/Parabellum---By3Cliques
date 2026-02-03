
# Plano: PATCH 1-SHOT — Remocao Total PWA + Purge Definitivo

## Resumo das Alteracoes

| Arquivo | Acao |
|---------|------|
| `index.html` | Remover theme-color + Substituir script anti-cache por PWA NUKER completo |
| `src/main.tsx` | Adicionar limpeza por BUILD_ID (async/IIFE seguro) |
| `src/lib/build/schemaVersion.ts` | Incrementar para `2026.02.03-v1` |
| `src/components/settings/SystemMaintenanceCard.tsx` | Criar novo componente |
| `src/pages/Settings.tsx` | Integrar card na secao Seguranca e Admin |

---

## Etapa 1 — index.html

### 1.1 Remover theme-color (linhas 22-24)

Remover completamente:
```html
<!-- Theme Color -->
<meta name="theme-color" content="#2563EB" />
```

### 1.2 Substituir script anti-cache (linhas 44-66)

Substituir pelo PWA NUKER que:
- Limpa CacheStorage MESMO se nao tiver SW
- Desregistra todos os SWs
- Reload 1x com guard

```javascript
(function () {
  try {
    var GUARD = "pwa_nuker_v1_done";
    if (sessionStorage.getItem(GUARD)) return;
    sessionStorage.setItem(GUARD, "1");

    var controlled = !!(navigator.serviceWorker && navigator.serviceWorker.controller);

    var unregisterSW = Promise.resolve();
    if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
      unregisterSW = navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      });
    }

    var clearCaches = Promise.resolve();
    if ("caches" in window && caches.keys) {
      clearCaches = caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      });
    }

    Promise.all([unregisterSW, clearCaches]).finally(function () {
      if (controlled) setTimeout(function(){ location.reload(); }, 80);
    });
  } catch (e) {}
})();
```

---

## Etapa 2 — src/main.tsx

Adicionar IIFE async para limpeza por BUILD_ID ANTES do check de SCHEMA_VERSION (apos imports, antes da linha 14):

```typescript
// ============================================
// LIMPEZA POR BUILD_ID - Limpa CacheStorage quando build muda
// ============================================
(async () => {
  try {
    const BUILD_ID_KEY = "app_last_build_id";
    const currentBuild = getCurrentBuildId();
    const lastSeenBuild = localStorage.getItem(BUILD_ID_KEY);

    if (lastSeenBuild && lastSeenBuild !== currentBuild) {
      console.log("[Main] 🔄 Novo build detectado, limpando CacheStorage...");
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        console.log("[Main] ✅ CacheStorage limpo:", keys.length, "caches removidos");
      }
    }

    localStorage.setItem(BUILD_ID_KEY, currentBuild);
  } catch (e) {
    console.warn("[Main] ⚠️ Build purge failed:", e);
  }
})();
```

---

## Etapa 3 — src/lib/build/schemaVersion.ts

Incrementar versao para forcar cleanup global:

```typescript
// Antes
export const APP_SCHEMA_VERSION = "2026.01.31-v1";

// Depois
export const APP_SCHEMA_VERSION = "2026.02.03-v1";
```

---

## Etapa 4 — Criar SystemMaintenanceCard.tsx

Novo arquivo `src/components/settings/SystemMaintenanceCard.tsx`:

```typescript
import { useState } from "react";
import { Trash2, RefreshCw, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hardRefresh } from "@/lib/build/ensureLatestBuild";
import { APP_SCHEMA_VERSION } from "@/lib/build/schemaVersion";
import { toast } from "sonner";

export function SystemMaintenanceCard() {
  const [clearing, setClearing] = useState(false);

  const handleReset = async () => {
    setClearing(true);
    toast.info("Limpando todos os caches...", {
      description: "Voce permanecera logado."
    });
    await new Promise(r => setTimeout(r, 500));
    await hardRefresh();
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-xl border bg-card">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-500">
        <HardDrive className="h-6 w-6 text-white" />
      </div>
      
      <div className="text-center space-y-1">
        <span className="font-medium text-sm text-foreground block">Manutencao</span>
        <span className="text-xs text-muted-foreground">v{APP_SCHEMA_VERSION}</span>
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={handleReset}
        disabled={clearing}
        className="w-full"
      >
        {clearing ? (
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        {clearing ? "Limpando..." : "Limpar Cache"}
      </Button>
    </div>
  );
}
```

---

## Etapa 5 — Integrar em Settings.tsx

1. Adicionar import:
```typescript
import { SystemMaintenanceCard } from "@/components/settings/SystemMaintenanceCard";
```

2. Adicionar card na secao "Seguranca e Admin" (apos linha 307):
```tsx
<SystemMaintenanceCard />
```

---

## Resultado Esperado

1. PWA NUKER limpa SW + CacheStorage no primeiro acesso (1x por sessao)
2. Limpeza automatica de CacheStorage quando BUILD_ID muda
3. Schema version incrementado forca cleanup global para todos
4. Card de manutencao visivel em /settings para reset manual
5. Chrome normal fica igual ao anonimo (sem lentidao)

---

## Criterios de Aceite

- DevTools > Application > Service Workers: nenhum ativo
- DevTools > Application > Cache Storage: vazio
- Chrome normal sem lentidao/funcoes reduzidas
- Card de manutencao aparece em /settings
- Console mostra logs de limpeza no primeiro acesso
