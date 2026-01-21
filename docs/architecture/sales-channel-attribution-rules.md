# Regras de Atribuição de Canais de Vendas

> **DOCUMENTO TRAVADO** - Aprovado em 21/01/2026
> 
> NÃO ALTERAR estas regras sem validação completa

---

## 1. Regra Definitiva Principal

### 🎯 COMERCIAL = Vendedor Atribuído (`assigned_to`)

| Condição | Canal Atribuído | Cor |
|----------|-----------------|-----|
| `assigned_to` preenchido | **Comercial** | #3b82f6 |
| `assigned_to` NULL + recorrência | Recorrência | #06b6d4 |
| `assigned_to` NULL + afiliado | Afiliados | #f97316 |
| `assigned_to` NULL + demais | Orgânico | #8b5cf6 |

**Princípio:** O campo `assigned_to` (vendedor atribuído) é o único fator que define se uma venda é "Comercial". Título, lead_source ou outros campos NÃO influenciam essa classificação.

---

## 2. Hierarquia de Prioridade (sem vendedor)

Quando `assigned_to` é NULL:

1. **Recorrência**: `lead_source` = "kiwify_recorrencia" ou "kiwify_renovacao"
2. **Afiliados**: `is_organic_sale` = false E `affiliate_name` preenchido
3. **Orgânico**: Fallback para demais casos

---

## 3. Casos de Teste Validados

### Cenários COMERCIAL (assigned_to preenchido)

| Cenário | assigned_to | lead_source | is_organic_sale | affiliate_name | Resultado |
|---------|-------------|-------------|-----------------|----------------|-----------|
| Vendedor atribuído via WhatsApp | `uuid-123` | whatsapp | null | null | ✅ Comercial |
| Vendedor atribuído via Manual | `uuid-456` | manual | null | null | ✅ Comercial |
| Recuperação COM vendedor | `uuid-789` | null | null | null | ✅ Comercial |
| Winback COM vendedor | `uuid-abc` | comercial | null | null | ✅ Comercial |

### Cenários NÃO-COMERCIAL (assigned_to = NULL)

| Cenário | assigned_to | lead_source | is_organic_sale | affiliate_name | Resultado |
|---------|-------------|-------------|-----------------|----------------|-----------|
| Recuperação SEM vendedor + afiliado | NULL | null | false | "João Silva" | ✅ Afiliados |
| Recuperação SEM vendedor + orgânico | NULL | null | true | null | ✅ Orgânico |
| Formulário SEM vendedor | NULL | formulario | null | null | ✅ Orgânico |
| WhatsApp SEM vendedor | NULL | whatsapp | null | null | ✅ Orgânico |
| Renovação automática | NULL | kiwify_recorrencia | null | null | ✅ Recorrência |
| Venda afiliado direta | NULL | kiwify_checkout | false | "Maria Costa" | ✅ Afiliados |
| Venda orgânica direta | NULL | kiwify_direto | true | null | ✅ Orgânico |

---

## 4. Implementação de Referência

### Hook: useWonDealsByChannel.tsx (linhas 121-154)

```typescript
function getChannelForDeal(deal: { 
  lead_source?: string | null; 
  is_organic_sale?: boolean | null;
  affiliate_name?: string | null;
  title?: string | null;
  assigned_to?: string | null;
}): { channel: string; color: string } {
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // REGRA DEFINITIVA (aprovada 21/01/2026):
  // COMERCIAL = Deal com vendedor atribuído (assigned_to preenchido)
  // Sem vendedor → classificar por: Recorrência, Afiliado ou Orgânico
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // REGRA PRINCIPAL: Se tem vendedor atribuído → COMERCIAL
  if (deal.assigned_to) {
    return { channel: "Comercial", color: "#3b82f6" };
  }
  
  // SEM VENDEDOR - Classificar por tipo de venda automática
  const source = deal.lead_source?.toLowerCase().trim();
  
  // Recorrência
  if (source === "kiwify_recorrencia" || source === "kiwify_renovacao") {
    return { channel: "Recorrência", color: "#06b6d4" };
  }
  
  // Afiliados (is_organic_sale=false + affiliate_name confirmado)
  if (deal.is_organic_sale === false && deal.affiliate_name) {
    return { channel: "Afiliados", color: "#f97316" };
  }
  
  // Orgânico (vendas diretas sem vendedor)
  return { channel: "Orgânico", color: "#8b5cf6" };
}
```

### Hook: useSalesByRep.tsx (linhas 42-83)

Mesma lógica aplicada para o ranking "Top Vendedores", com categorias:
- Vendedor real → Nome do vendedor
- Sem vendedor → "Recorrência", "Vendas Afiliados", ou "Vendas Orgânicas"

---

## 5. Detalhamento Comercial (Subcanais)

Quando `assigned_to` está preenchido, o deal também é categorizado por subcanal:

| Subcanal | Condição | Ícone |
|----------|----------|-------|
| WhatsApp | `lead_source` = "whatsapp" | MessageCircle |
| Manual | `lead_source` = "manual" ou "comercial" | UserCheck |
| Webchat | `lead_source` = "webchat" | Globe |
| Recuperação | `title` começa com "recuperação" ou "winback" | RefreshCw |
| Formulários | `lead_source` = "formulario", "form", "chat_widget" | FileText |

**Nota:** Estes subcanais SÓ aparecem se o deal tem vendedor atribuído.

---

## 6. Arquivos Relacionados

| Arquivo | Função | Status |
|---------|--------|--------|
| `src/hooks/useWonDealsByChannel.tsx` | Classificação principal | ✅ Atualizado |
| `src/hooks/useSalesByRep.tsx` | Ranking de vendedores | ✅ Atualizado |
| `src/components/analytics/SalesSubscriptionsTab.tsx` | UI de visualização | ✅ Atualizado |

---

## 7. Histórico de Alterações

| Data | Alteração | Motivo |
|------|-----------|--------|
| 21/01/2026 | Regra definitiva: assigned_to = Comercial | Corrigir deals "Recuperação" pagos via afiliado |
| 21/01/2026 | Documentação criada | Garantir consistência futura |
