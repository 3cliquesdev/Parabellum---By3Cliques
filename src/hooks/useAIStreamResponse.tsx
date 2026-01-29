import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StreamState {
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  error: string | null;
}

/**
 * Hook para consumir streaming SSE de respostas da IA
 * 
 * FLUXO:
 * 1. Inicia conexão SSE com ai-chat-stream
 * 2. Recebe tokens incrementalmente
 * 3. Atualiza UI progressivamente
 * 4. Ao finalizar, Realtime sincroniza mensagem persistida
 * 
 * LATÊNCIA: <1s para primeira palavra (vs 5-20s síncrono)
 */
export function useAIStreamResponse(conversationId: string | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    streamingContent: '',
    streamingMessageId: null,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  // Limpar ao trocar de conversa
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [conversationId]);

  // Subscrever ao typing indicator via Realtime
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on('broadcast', { event: 'ai_typing' }, (payload) => {
        console.log('[useAIStreamResponse] Typing indicator:', payload);
        // Opcional: atualizar estado de typing global
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const triggerStream = useCallback(async (customerMessage: string): Promise<void> => {
    if (!conversationId) {
      console.error('[useAIStreamResponse] No conversationId provided');
      return;
    }

    // Cancelar stream anterior se houver
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Gerar ID local para a mensagem streaming (será substituído pelo real)
    const localStreamId = `streaming-${crypto.randomUUID()}`;
    streamingMessageIdRef.current = localStreamId;

    setState({
      isStreaming: true,
      streamingContent: '',
      streamingMessageId: localStreamId,
      error: null,
    });

    // Adicionar mensagem placeholder no cache
    queryClient.setQueryData(
      ['messages', conversationId],
      (old: any[] = []) => [
        ...old,
        {
          id: localStreamId,
          conversation_id: conversationId,
          content: '',
          sender_type: 'user',
          is_ai_generated: true,
          is_internal: false,
          created_at: new Date().toISOString(),
          status: 'streaming',
          media_attachments: [],
          sender: null,
        }
      ]
    );

    const t0 = performance.now();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ conversationId, customerMessage }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let firstTokenTime: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Processar linhas SSE
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.content) {
              // Marcar TTFB do primeiro token
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
                console.log('[useAIStreamResponse] ⚡ TTFB:', (firstTokenTime - t0).toFixed(0), 'ms');
              }

              accumulatedContent += parsed.content;

              // Atualizar estado e cache
              setState(prev => ({
                ...prev,
                streamingContent: accumulatedContent,
              }));

              // Atualizar mensagem no cache
              queryClient.setQueryData(
                ['messages', conversationId],
                (old: any[] = []) => old.map(m =>
                  m.id === localStreamId
                    ? { ...m, content: accumulatedContent }
                    : m
                )
              );
            }

            if (parsed.done) {
              console.log('[useAIStreamResponse] ✅ Stream complete:', {
                messageId: parsed.messageId,
                totalTime: parsed.totalTime,
                contentLength: accumulatedContent.length
              });

              // Substituir mensagem streaming pela real do banco
              if (parsed.messageId && parsed.messageId !== localStreamId) {
                queryClient.setQueryData(
                  ['messages', conversationId],
                  (old: any[] = []) => old.map(m =>
                    m.id === localStreamId
                      ? { ...m, id: parsed.messageId, status: 'sent' }
                      : m
                  )
                );
              }

              setState(prev => ({
                ...prev,
                isStreaming: false,
                streamingMessageId: parsed.messageId || localStreamId,
              }));
            }
          } catch (parseError) {
            // JSON incompleto, será processado no próximo chunk
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Processar buffer restante
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.content) {
              accumulatedContent += parsed.content;
              setState(prev => ({ ...prev, streamingContent: accumulatedContent }));
              queryClient.setQueryData(
                ['messages', conversationId],
                (old: any[] = []) => old.map(m =>
                  m.id === localStreamId ? { ...m, content: accumulatedContent } : m
                )
              );
            }
          } catch { /* ignore */ }
        }
      }

      const totalTime = performance.now() - t0;
      console.log('[useAIStreamResponse] 📊 METRICS:', {
        total: totalTime.toFixed(0) + 'ms',
        ttfb: firstTokenTime ? (firstTokenTime - t0).toFixed(0) + 'ms' : 'N/A',
        contentLength: accumulatedContent.length
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[useAIStreamResponse] Stream aborted by user');
        return;
      }

      console.error('[useAIStreamResponse] Stream error:', error);

      // Marcar mensagem como falhou
      queryClient.setQueryData(
        ['messages', conversationId],
        (old: any[] = []) => old.map(m =>
          m.id === localStreamId
            ? { ...m, content: 'Erro ao gerar resposta', status: 'failed' }
            : m
        )
      );

      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      abortControllerRef.current = null;
      streamingMessageIdRef.current = null;
    }
  }, [conversationId, queryClient]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: null,
      }));
    }
  }, []);

  return {
    ...state,
    triggerStream,
    cancelStream,
  };
}
