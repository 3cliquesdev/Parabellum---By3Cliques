

# Fix: Download da Planilha Bloqueado pelo Iframe

## Problema

O `XLSX.writeFile()` tenta disparar um download diretamente, mas dentro de iframes (como o preview do Lovable), o navegador bloqueia downloads silenciosos. O toast de sucesso aparece porque o codigo roda sem erro — mas o arquivo nunca chega ao usuario.

## Solucao

Substituir `XLSX.writeFile(wb, filename)` por uma abordagem manual com Blob + link programatico que funciona em qualquer contexto (iframe ou nao):

1. Gerar o arquivo como array buffer: `XLSX.write(wb, { bookType: "xlsx", type: "array" })`
2. Criar um `Blob` com o tipo MIME correto
3. Criar um `<a>` temporario com `URL.createObjectURL`
4. Disparar o click programaticamente
5. Limpar o objeto URL

## Mudanca

**Arquivo**: `src/hooks/useExportConversationsCSV.tsx`

**Linha 104** — substituir:
```typescript
XLSX.writeFile(wb, `relatorio_conversas_${dateStr}.xlsx`);
```

Por:
```typescript
const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `relatorio_conversas_${dateStr}.xlsx`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

## Impacto

- Zero regressao: apenas muda o metodo de disparo do download
- Funciona em iframe, popup e janela normal
- Mesmo arquivo Excel gerado, mesmos dados

