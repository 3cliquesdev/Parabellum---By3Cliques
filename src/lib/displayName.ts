/**
 * Monta o nome de exibição evitando duplicação (ex: "João Silva João Silva").
 * Usado em todos os componentes que exibem nome de contato.
 */
export function displayName(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();

  // Se ambos forem iguais, exibe apenas uma vez
  if (f && l && f === l) return f;

  return `${f} ${l}`.trim() || 'Cliente';
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
