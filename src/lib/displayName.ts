/**
 * Nomes genéricos que devem acionar fallback para email/phone.
 */
const GENERIC_NAMES = new Set(['cliente', 'desconhecido', 'sem nome', 'contato', '']);

/**
 * Monta o nome de exibição evitando duplicação e usando fallback inteligente.
 * Quando o nome é genérico ("Cliente", etc.), usa email ou phone como fallback.
 */
export function displayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
  phone?: string | null,
): string {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();

  let name: string;

  // Se ambos forem iguais, exibe apenas uma vez
  if (f && l && f === l) {
    name = f;
  } else {
    name = `${f} ${l}`.trim();
  }

  // Se o nome é genérico, usar fallback
  if (GENERIC_NAMES.has(name.toLowerCase())) {
    if (email) {
      // Pega parte antes do @ e capitaliza
      const local = email.split('@')[0] || '';
      if (local) {
        return local.charAt(0).toUpperCase() + local.slice(1);
      }
    }
    if (phone) {
      return phone;
    }
    return name || 'Cliente';
  }

  return name || 'Cliente';
}

/**
 * Retorna as iniciais para avatar, sem duplicar quando nomes são iguais.
 */
export function displayInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();

  if (f && l && f === l) {
    // Nome duplicado — pegar iniciais do nome completo
    const parts = f.split(' ').filter(Boolean);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }

  return ((f?.[0] || '') + (l?.[0] || '')).toUpperCase();
}
