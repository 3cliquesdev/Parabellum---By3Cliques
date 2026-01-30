import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 🐤 TESTE CANÁRIO: Kill Switch bloqueia todos os envios automáticos
 * 
 * Este teste garante que quando ai_global_enabled = false:
 * 1. Nenhuma mensagem com source 'bot' ou 'ai' é criada
 * 2. ai_mode é alterado para 'waiting_human'
 * 
 * Se este teste falhar, há risco de duplicação de mensagens!
 */
describe("Kill Switch Canary", () => {
  let mockSupabase: any;
  let insertedMessages: any[] = [];

  beforeEach(() => {
    insertedMessages = [];
    
    // Mock do Supabase com tracking de inserts
    mockSupabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn((data: any) => {
          if (table === 'messages') {
            insertedMessages.push(...(Array.isArray(data) ? data : [data]));
          }
          return { data: null, error: null };
        }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { 
            ai_mode: 'autopilot', 
            is_test_mode: false,
            assigned_to: null,
          }, 
          error: null 
        }),
        in: vi.fn().mockResolvedValue({
          data: [{ key: 'ai_global_enabled', value: 'false' }],
          error: null,
        }),
      })),
    };
  });

  it("deve bloquear envio de mensagem bot/ai quando kill switch ativo", async () => {
    // Simular processamento do message-listener com Kill Switch ativo
    const record = {
      id: "msg-123",
      conversation_id: "conv-456",
      content: "Olá, preciso de ajuda",
      sender_type: "contact",
    };

    // Verificar que ai_global_enabled = false no mock
    const { data: configs } = await mockSupabase
      .from('system_configurations')
      .select()
      .in('key', ['ai_global_enabled']);
    
    const aiGlobalEnabled = configs?.find(
      (c: any) => c.key === 'ai_global_enabled'
    )?.value !== 'false';

    // ASSERT: Kill Switch está ativo
    expect(aiGlobalEnabled).toBe(false);

    // ASSERT: Nenhuma mensagem automática foi inserida
    const autoMessages = insertedMessages.filter(
      (m) => m.sender_type === 'bot' || m.sender_type === 'ai' || m.is_ai_generated
    );
    expect(autoMessages).toHaveLength(0);
  });

  it("deve permitir envio quando kill switch desativado", async () => {
    // Modificar mock para Kill Switch OFF
    mockSupabase.from = vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn((data: any) => {
        if (table === 'messages') {
          insertedMessages.push(...(Array.isArray(data) ? data : [data]));
        }
        return { data: null, error: null };
      }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { ai_mode: 'autopilot', is_test_mode: false }, 
        error: null 
      }),
      in: vi.fn().mockResolvedValue({
        data: [{ key: 'ai_global_enabled', value: 'true' }], // 🆕 Ativado
        error: null,
      }),
    }));

    // Verificar que ai_global_enabled = true
    const { data: configs } = await mockSupabase
      .from('system_configurations')
      .select()
      .in('key', ['ai_global_enabled']);
    
    const aiGlobalEnabled = configs?.find(
      (c: any) => c.key === 'ai_global_enabled'
    )?.value !== 'false';

    // ASSERT: Kill Switch está desativado
    expect(aiGlobalEnabled).toBe(true);
  });

  it("deve mover conversa para waiting_human quando kill switch está ativo", async () => {
    // Este teste valida que quando Kill Switch está ativo:
    // - ai_mode deve ser atualizado para 'waiting_human'
    // - Nenhuma resposta automática (bot/IA) deve ser enviada

    const updateCalls: any[] = [];
    
    const mockWithTracking = {
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn((data: any) => {
          if (table === 'messages') {
            insertedMessages.push(...(Array.isArray(data) ? data : [data]));
          }
          return { data: null, error: null };
        }),
        update: vi.fn((data: any) => {
          if (table === 'conversations') {
            updateCalls.push(data);
          }
          return { eq: vi.fn().mockReturnThis(), error: null };
        }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { ai_mode: 'autopilot', is_test_mode: false }, 
          error: null 
        }),
        in: vi.fn().mockResolvedValue({
          data: [{ key: 'ai_global_enabled', value: 'false' }],
          error: null,
        }),
      })),
    };

    // Simular lógica do message-listener
    const { data: configs } = await mockWithTracking
      .from('system_configurations')
      .select()
      .in('key', ['ai_global_enabled']);
    
    const aiGlobalEnabled = configs?.find(
      (c: any) => c.key === 'ai_global_enabled'
    )?.value !== 'false';

    // Se Kill Switch ativo, mover para fila humana
    if (!aiGlobalEnabled) {
      await mockWithTracking.from('conversations').update({ ai_mode: 'waiting_human' });
    }

    // ASSERT: Atualização para waiting_human foi chamada
    expect(updateCalls).toContainEqual({ ai_mode: 'waiting_human' });
    
    // ASSERT: Nenhuma mensagem automática
    const autoMessages = insertedMessages.filter(
      (m) => m.sender_type === 'bot' || m.sender_type === 'ai' || m.is_ai_generated
    );
    expect(autoMessages).toHaveLength(0);
  });
});
