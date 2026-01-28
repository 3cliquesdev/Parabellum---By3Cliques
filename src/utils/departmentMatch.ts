/**
 * Normaliza nomes de departamento para comparação:
 * - lowercase
 * - remove acentos
 * - trim
 */
export function normalizeDepartmentName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Faz match entre uma lista de "departamentos permitidos" (por nome)
 * e o nome do departamento da conversa.
 *
 * Regras:
 * - match exato
 * - match por prefixo com separadores (ex: "suporte" casa com "suporte sistema")
 * - match por palavra (evita falso-positivo em substrings muito curtas)
 */
export function isDepartmentAllowedByName(
  allowedDepartmentNames: string[] | undefined,
  conversationDepartmentName: string | null | undefined
): boolean {
  if (!conversationDepartmentName) return true;
  if (!allowedDepartmentNames || allowedDepartmentNames.length === 0) return true;

  const conv = normalizeDepartmentName(conversationDepartmentName);

  return allowedDepartmentNames.some((allowedRaw) => {
    const allowed = normalizeDepartmentName(allowedRaw);
    if (!allowed) return false;

    if (conv === allowed) return true;

    // Suporta hierarquia por nome: "suporte" -> "suporte sistema", "suporte/pedidos", etc.
    if (conv.startsWith(allowed + " ") || conv.startsWith(allowed + "-") || conv.startsWith(allowed + "/")) {
      return true;
    }

    // Match por palavra inteira (word boundary) usando caracteres alfanuméricos + underscore
    // Ex: evita que "fin" case com "financeiro".
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(allowed)}([^\\p{L}\\p{N}_]|$)`, "iu");
    return re.test(conv);
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
