

# Plano: Correção Definitiva do Fluxo de Áudio (Com Ajustes Solicitados)

## Resumo dos Ajustes

1. **Logs sem emojis** - texto limpo para observabilidade enterprise
2. **Abortar de verdade** - não seguir com blob inválido (< 10KB)

---

## Fase 1: AudioRecorder - Logs e Validação com Abort

**Arquivo:** `src/components/inbox/AudioRecorder.tsx`

**Alteração na função `handleConfirm` (linhas 47-57):**

```typescript
const handleConfirm = () => {
  if (!audioBlob) {
    console.error("[AudioRecorder] no blob available");
    return;
  }

  // Log obrigatorio para diagnostico (sem emojis)
  console.log("[AudioRecorder] blob", {
    type: audioBlob.type,
    size: audioBlob.size,
    sizeKB: Math.round(audioBlob.size / 1024),
    valid: audioBlob.size > 10000,
  });

  // Validar tamanho minimo (10KB = ~1 segundo de audio)
  // Se menor, a gravacao falhou - ABORTAR (nao seguir adiante)
  if (audioBlob.size < 10000) {
    console.error("[AudioRecorder] recording failed: blob too small", audioBlob.size);
    return; // Aborta - nao envia lixo
  }

  const extension = audioBlob.type.includes('webm') ? 'webm' : 'ogg';
  const file = new File(
    [audioBlob], 
    `audio-${Date.now()}.${extension}`, 
    { type: audioBlob.type }
  );
  onRecordingComplete(file);
};
```

**Mudanças:**
- Log sem emojis: `[AudioRecorder] blob`
- Abort real com `return` se blob < 10KB
- Não envia "lixo" adiante

---

## Fase 2: audioTranscoder - Comando FFmpeg Corrigido

**Arquivo:** `src/lib/audio/audioTranscoder.ts`

### 2.1 Remover emojis de todos os logs (linhas 21-80)

```typescript
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) {
    console.log('[AudioTranscoder] FFmpeg already loaded');
    return ffmpeg;
  }

  if (loadingPromise) {
    console.log('[AudioTranscoder] FFmpeg loading in progress, waiting...');
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log('[AudioTranscoder] Loading FFmpeg WASM...');
    
    // ... resto do codigo ...
    
    console.log('[AudioTranscoder] FFmpeg loaded successfully');
    // ...
  })();
  // ...
}
```

### 2.2 Alterar comando FFmpeg com `-map 0:a:0` (linhas 155-164)

```typescript
await ff.exec([
  '-i', inputFileName,
  '-map', '0:a:0',        // CRITICAL: force audio stream mapping
  '-c:a', 'libopus',
  '-b:a', '24k',          // 24k is enough for voice
  '-application', 'voip', // Optimized for voice
  '-y',                   // Overwrite output
  outputFileName
]);
```

**Mudanças:**
- Adicionado `-map 0:a:0` (sem isso, FFmpeg pode gerar OGG mudo)
- Bitrate 24k (suficiente para voz, menor tamanho)
- Removido `-ar` e `-ac` (Opus padrão é 48kHz mono)
- Sem `-vbr on` por segurança (alguns builds podem rejeitar)

### 2.3 Adicionar validação de header OggS (após ler output)

```typescript
// VALIDATE OGG header (magic bytes must be "OggS")
const outputBytes = new Uint8Array(arrayBuffer);
const headerBytes = outputBytes.slice(0, 4);
const header = new TextDecoder().decode(headerBytes);

if (header !== 'OggS') {
  console.error('[AudioTranscoder] Invalid OGG header:', header);
  throw new Error(`Transcode invalid: expected "OggS", got "${header}"`);
}

console.log('[AudioTranscoder] OggS header validated');
```

### 2.4 Remover fallback perigoso (linhas 211-217)

```typescript
} catch (error) {
  console.error('[AudioTranscoder] Transcoding failed:', error);
  
  // NO FALLBACK: Do not return WebM - Meta will reject it
  // Propagate error so SuperComposer shows toast and aborts
  throw error;
}
```

---

## Arquivos a Modificar

| Arquivo | Tipo | Mudanças |
|---------|------|----------|
| `src/components/inbox/AudioRecorder.tsx` | Edição | handleConfirm com log + abort |
| `src/lib/audio/audioTranscoder.ts` | Edição | Logs sem emoji, `-map`, validação OggS, sem fallback |

---

## Fluxo Corrigido

```text
GRAVACAO
    |
    v
Blob (audio/webm;codecs=opus)
    |
    +-- Log: type, size, sizeKB (sem emoji)
    |
    +-- size < 10KB? --> return (ABORT - nao envia)
    |
    v
TRANSCODE (FFmpeg WASM)
    |
    +-- -map 0:a:0 (forca trilha de audio)
    +-- -c:a libopus
    +-- -b:a 24k
    +-- -application voip
    |
    v
Validar Header == "OggS"
    |
    +-- Header != "OggS" --> throw Error
    |
    +-- Header == "OggS" --> Blob OGG valido
    |
    v
UPLOAD (contentType: audio/ogg)
    |
    v
send-meta-whatsapp --> Meta API --> Cliente recebe
```

---

## Criterios de Aceite

| Criterio | Validacao |
|----------|-----------|
| Gravacao funciona | Log mostra `sizeKB > 10` |
| Blob invalido aborta | Log mostra `recording failed: blob too small` e nao envia |
| Transcode funciona | Log mostra `OggS header validated` |
| Arquivo e OGG real | Magic bytes = `OggS` |
| WhatsApp recebe | Mensagem chega no cliente |
| Chat interno toca | AudioPlayer reproduz com som |
| Erro e tratado | Toast "Falha ao converter" se FFmpeg falhar |

---

## Observacoes Tecnicas

### Por que `-map 0:a:0` e critico?

O FFmpeg, ao processar WebM com metadados complexos, pode nao selecionar automaticamente a trilha de audio. O flag `-map 0:a:0` forca:
- `0` = primeiro input
- `a` = tipo audio
- `0` = primeira trilha de audio

Sem isso, o output pode ser OGG valido mas sem dados de audio (arquivo "mudo").

### Por que remover fallback?

O fallback antigo retornava o WebM original quando FFmpeg falhava. Meta rejeita WebM, entao o audio nunca chegaria. Melhor falhar explicitamente com erro do que enviar arquivo incompativel.

### Por que validar header OggS?

Os primeiros 4 bytes de qualquer arquivo OGG sao `OggS` (magic bytes). Validar isso garante que o FFmpeg realmente produziu um container OGG valido.

### Por que remover `-vbr on`?

Em alguns builds do FFmpeg WASM, `-vbr on` pode nao ser aceito. O codec Opus ja usa VBR por padrao, entao e seguro omitir.

