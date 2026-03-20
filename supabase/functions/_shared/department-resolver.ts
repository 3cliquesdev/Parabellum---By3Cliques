/**
 * Resolver dinâmico de departamentos — elimina UUIDs hardcoded.
 * Faz UMA query ao banco e retorna mapas por nome exato e por slug.
 * Fallbacks aos UUIDs legados garantem zero downtime.
 */

// Fallbacks legados (usados apenas se query falhar)
const LEGACY_FALLBACKS: Record<string, string> = {
  'Comercial - Nacional': 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c',
  'Comercial - Internacional': '68195a0f-1f9e-406b-b714-c889b4145f60',
  'Financeiro': 'af3c75a9-2e3f-49f1-8e0b-7fb3f4b5ee45',
  'Customer Success': 'b7149bf4-1356-4ca5-bc9a-8caacf7b6e80',
  'Suporte': '36ce66cd-7414-4fc8-bd4a-268fecc3f01a',
  'Suporte Pedidos': '2dd0ee5c-fd20-44be-94ad-f83f1be1c4e9',
  'Suporte Sistema': 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4',
};

export interface DepartmentMap {
  /** Busca por nome exato: "Comercial - Nacional" → uuid */
  byName: Map<string, string>;
  /** Busca por slug (primeira palavra lowercase): "comercial" → uuid */
  bySlug: Map<string, string>;
  /** Atalhos diretos para uso frequente */
  COMERCIAL_ID: string;
  SUPORTE_ID: string;
  /** Mapa intent → departmentId para roteamento de intenções */
  INTENT_MAP: Record<string, string>;
}

export async function resolveDepartments(supabaseClient: any): Promise<DepartmentMap> {
  const byName = new Map<string, string>();
  const bySlug = new Map<string, string>();

  try {
    const { data } = await supabaseClient
      .from('departments')
      .select('id, name');

    for (const d of (data || [])) {
      byName.set(d.name, d.id);
      const slug = d.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().split(/[\s\-\/]+/)[0];
      if (!bySlug.has(slug)) bySlug.set(slug, d.id);
    }
  } catch (err) {
    console.error('[department-resolver] Query failed, using legacy fallbacks:', err);
  }

  // Preencher fallbacks para nomes que não vieram do banco
  for (const [name, id] of Object.entries(LEGACY_FALLBACKS)) {
    if (!byName.has(name)) byName.set(name, id);
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().split(/[\s\-\/]+/)[0];
    if (!bySlug.has(slug)) bySlug.set(slug, id);
  }

  const COMERCIAL_ID = byName.get('Comercial - Nacional') || LEGACY_FALLBACKS['Comercial - Nacional'];
  const SUPORTE_ID = byName.get('Suporte') || LEGACY_FALLBACKS['Suporte'];

  // Mapa de intenção → department ID (usado em process-chat-flow, auto-close, etc.)
  const INTENT_MAP: Record<string, string> = {
    'comercial': COMERCIAL_ID,
    'internacional': byName.get('Comercial - Internacional') || LEGACY_FALLBACKS['Comercial - Internacional'],
    'comercial_internacional': byName.get('Comercial - Internacional') || LEGACY_FALLBACKS['Comercial - Internacional'],
    'financeiro': byName.get('Financeiro') || LEGACY_FALLBACKS['Financeiro'],
    'saque': byName.get('Financeiro') || LEGACY_FALLBACKS['Financeiro'],
    'cancelamento': byName.get('Customer Success') || LEGACY_FALLBACKS['Customer Success'],
    'suporte': SUPORTE_ID,
    'pedidos': byName.get('Suporte Pedidos') || LEGACY_FALLBACKS['Suporte Pedidos'],
    'suporte_sistema': byName.get('Suporte Sistema') || LEGACY_FALLBACKS['Suporte Sistema'],
    'sistema': byName.get('Suporte Sistema') || LEGACY_FALLBACKS['Suporte Sistema'],
    'devolucao': SUPORTE_ID,
  };

  return { byName, bySlug, COMERCIAL_ID, SUPORTE_ID, INTENT_MAP };
}
