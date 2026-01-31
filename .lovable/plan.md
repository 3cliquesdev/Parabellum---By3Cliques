
# Plano: Correção Completa do Fluxo de Áudio no Chat

## Resumo Executivo

O sistema tem dois problemas distintos que impedem o funcionamento correto do áudio:

1. **Envio**: Chrome grava em WebM, mas Meta só aceita OGG. A conversão atual é superficial (só muda MIME type, não o container real).

2. **Recebimento**: Áudios do Meta chegam sem som porque o player não especifica o codec correto.

---

## Correções Necessárias

### Fase 1: Corrigir Aceitação de Tipos no Input

**Arquivo:** `src/components/inbox/FileDropZone.tsx`

Adicionar `audio/webm` na lista `DEFAULT_ACCEPTED_TYPES` para permitir upload de arquivos gravados pelo navegador:

```text
Adicionar na linha 30:
  "audio/webm",
```

---

### Fase 2: Melhorar Transcodificação FFmpeg WASM

**Arquivo:** `src/lib/audio/audioTranscoder.ts`

1. Adicionar logs mais detalhados para debug
2. Tratar erros de forma mais robusta
3. Verificar se FFmpeg carregou corretamente antes de usar

---

### Fase 3: Fallback Server-Side para Transcodificação

**Novo arquivo:** `supabase/functions/transcode-audio/index.ts`

Criar Edge Function que faz transcodificação real WebM → OGG usando `ffmpeg` no Deno. Isso garante que mesmo se o browser falhar, o servidor consegue converter.

Fluxo:
1. Frontend tenta FFmpeg WASM
2. Se falhar ou for WebM, envia para Edge Function
3. Edge Function retorna OGG real
4. Arquivo é salvo no storage

---

### Fase 4: Corrigir Player de Áudio

**Arquivo:** `src/components/inbox/AudioPlayer.tsx`

Alterar de:
```jsx
<audio ref={audioRef} src={url} preload="metadata" />
```

Para:
```jsx
<audio ref={audioRef} preload="metadata">
  <source src={url} type="audio/ogg" />
  <source src={url} type="audio/mpeg" />
  <source src={url} type="audio/webm" />
  Seu navegador não suporta áudio.
</audio>
```

Isso permite que o navegador escolha o codec correto baseado no conteúdo.

---

### Fase 5: Corrigir Edge Function send-meta-whatsapp

**Arquivo:** `supabase/functions/send-meta-whatsapp/index.ts`

O problema é que apenas mudar o MIME type do Blob não muda o container real. Soluções:

**Opção A (Preferida)**: Chamar Edge Function de transcodificação antes de enviar para Meta
**Opção B**: Usar biblioteca Deno para conversão real no backend

---

## Detalhes Técnicos

### Por que Chrome não grava OGG nativo?

O `MediaRecorder` do Chrome suporta:
- `audio/webm;codecs=opus` ✅
- `audio/webm;codecs=pcm` ✅  
- `audio/ogg;codecs=opus` ❌ (não suportado no Chrome)

Apenas Firefox suporta OGG nativo.

### Por que re-wrap não funciona?

WebM e OGG são containers diferentes:
- WebM: baseado em Matroska (MKV)
- OGG: container próprio da Xiph

Ambos podem conter áudio Opus, mas os headers são incompatíveis. Mudar apenas o MIME type faz o Meta rejeitar porque ele valida os magic bytes do arquivo.

### Solução Real

Usar FFmpeg (WASM no browser ou nativo no Deno) para:
1. Extrair o stream Opus do WebM
2. Re-empacotar no container OGG
3. Gerar arquivo válido para Meta

---

## Arquivos a Modificar

1. `src/components/inbox/FileDropZone.tsx` - Adicionar audio/webm
2. `src/components/inbox/AudioPlayer.tsx` - Usar source tags
3. `src/lib/audio/audioTranscoder.ts` - Melhorar error handling
4. `src/components/inbox/SuperComposer.tsx` - Fallback para server
5. `supabase/functions/transcode-audio/index.ts` - Nova função
6. `supabase/functions/send-meta-whatsapp/index.ts` - Usar transcodificação real
7. `supabase/config.toml` - Registrar nova função

---

## Ordem de Implementação

1. Primeiro corrigir FileDropZone (5 min)
2. Corrigir AudioPlayer (5 min)
3. Melhorar transcodificação WASM (10 min)
4. Criar Edge Function transcode-audio (20 min)
5. Integrar com send-meta-whatsapp (10 min)
6. Testar fluxo completo

---

## Resultado Esperado

- Gravar áudio no Chrome → Transcodificar → Enviar ao Meta → Cliente recebe
- Cliente envia áudio → Meta entrega → Download → Player toca com som
